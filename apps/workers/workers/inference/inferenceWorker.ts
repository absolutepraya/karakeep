import { and, eq } from "drizzle-orm";
import { workerStatsCounter } from "metrics";
import { withWorkerEventLog, withWorkerTracing } from "workerTracing";

import type { ZOpenAIRequest } from "@karakeep/shared-server";
import { db } from "@karakeep/db";
import { bookmarkTranscripts, bookmarks } from "@karakeep/db/schema";
import {
  addLogFields,
  OpenAIQueue,
  zOpenAIRequestSchema,
} from "@karakeep/shared-server";
import serverConfig from "@karakeep/shared/config";
import { InferenceClientFactory } from "@karakeep/shared/inference";
import logger from "@karakeep/shared/logger";
import { DequeuedJob, getQueueClient } from "@karakeep/shared/queueing";

import { runSummarization } from "./summarize";
import { runTagging } from "./tagging";

async function attemptMarkStatus(
  jobData: object | undefined,
  status: "success" | "failure",
  summaryWritten = true,
) {
  if (!jobData) {
    return;
  }
  try {
    const request = zOpenAIRequestSchema.parse(jobData);
    if (
      request.type === "summarize" &&
      request.summarySource === "transcript" &&
      request.transcriptRevision !== undefined
    ) {
      const transcript = await db.query.bookmarkTranscripts.findFirst({
        where: eq(bookmarkTranscripts.bookmarkId, request.bookmarkId),
        columns: { revision: true },
      });
      if (transcript?.revision !== request.transcriptRevision) {
        return;
      }
    }
    if (
      request.type === "summarize" &&
      status === "success" &&
      !summaryWritten
    ) {
      await db
        .update(bookmarks)
        .set({ summarizationStatus: null })
        .where(
          and(
            eq(bookmarks.id, request.bookmarkId),
            eq(bookmarks.summarizationStatus, "pending"),
          ),
        );
      return;
    }
    await db
      .update(bookmarks)
      .set({
        ...(request.type === "summarize"
          ? { summarizationStatus: status }
          : {}),
        ...(request.type === "tag" ? { taggingStatus: status } : {}),
      })
      .where(
        request.type === "summarize" && status === "success"
          ? and(
              eq(bookmarks.id, request.bookmarkId),
              eq(bookmarks.summaryStale, false),
            )
          : eq(bookmarks.id, request.bookmarkId),
      );
  } catch (e) {
    logger.error(`Something went wrong when marking the tagging status: ${e}`);
  }
}

export class OpenAiWorker {
  static async build() {
    logger.info("Starting inference worker ...");
    const worker = (await getQueueClient())!.createRunner<
      ZOpenAIRequest,
      boolean | undefined
    >(
      OpenAIQueue,
      {
        run: withWorkerTracing(
          "inferenceWorker.run",
          withWorkerEventLog("inferenceWorker.run", runOpenAI),
        ),
        onComplete: async (job, result) => {
          workerStatsCounter.labels("inference", "completed").inc();
          const jobId = job.id;
          logger.info(`[inference][${jobId}] Completed successfully`);
          await attemptMarkStatus(job.data, "success", result);
        },
        onError: async (job) => {
          workerStatsCounter.labels("inference", "failed").inc();
          const jobId = job.id;
          logger.error(
            `[inference][${jobId}] inference job failed: ${job.error}\n${job.error.stack}`,
          );
          if (job.numRetriesLeft == 0) {
            workerStatsCounter.labels("inference", "failed_permanent").inc();
            await attemptMarkStatus(job?.data, "failure");
          }
        },
      },
      {
        concurrency: serverConfig.inference.numWorkers,
        pollIntervalMs: 1000,
        timeoutSecs: serverConfig.inference.jobTimeoutSec,
      },
    );

    return worker;
  }
}

async function runOpenAI(
  job: DequeuedJob<ZOpenAIRequest>,
): Promise<boolean | undefined> {
  const jobId = job.id;

  const inferenceClient = InferenceClientFactory.build();
  if (!inferenceClient) {
    logger.debug(
      `[inference][${jobId}] No inference client configured, nothing to do now`,
    );
    return undefined;
  }

  const request = zOpenAIRequestSchema.safeParse(job.data);
  if (!request.success) {
    throw new Error(
      `[inference][${jobId}] Got malformed job request: ${request.error.toString()}`,
    );
  }

  const { bookmarkId } = request.data;
  const bookmark = await db.query.bookmarks.findFirst({
    where: eq(bookmarks.id, bookmarkId),
    columns: {
      userId: true,
    },
  });

  addLogFields<"inferenceWorker.run">({
    "bookmark.id": bookmarkId,
    "inference.type": request.data.type,
    ...(bookmark ? { "user.id": bookmark.userId } : {}),
  });
  switch (request.data.type) {
    case "summarize":
      return runSummarization(bookmarkId, job, inferenceClient);
    case "tag":
      await runTagging(bookmarkId, job, inferenceClient);
      return undefined;
    default:
      throw new Error(`Unknown inference type: ${request.data.type}`);
  }
}
