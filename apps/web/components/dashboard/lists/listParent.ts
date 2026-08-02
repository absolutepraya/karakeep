import type { ZBookmarkList } from "@karakeep/shared/types/lists";

export function resolveListParentId(
  list: Pick<ZBookmarkList, "parentId"> | undefined,
  prefill: Partial<Pick<ZBookmarkList, "parentId">> | undefined,
  pathname: string,
) {
  if (list) {
    return list.parentId;
  }
  if (prefill?.parentId !== undefined) {
    return prefill.parentId;
  }
  return pathname.match(/^\/dashboard\/lists\/([^/]+)$/)?.[1];
}
