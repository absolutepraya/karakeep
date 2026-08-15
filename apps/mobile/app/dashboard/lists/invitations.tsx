import { ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { Button } from "@/components/ui/Button";
import FullPageSpinner from "@/components/ui/FullPageSpinner";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/ui/Toast";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useTRPC } from "@karakeep/shared-react/trpc";

const invitationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default function ListInvitationsPage() {
  const api = useTRPC();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: invitations, isPending } = useQuery(
    api.lists.getPendingInvitations.queryOptions(),
  );

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries(
        api.lists.getPendingInvitations.pathFilter(),
      ),
      queryClient.invalidateQueries(api.lists.list.pathFilter()),
    ]);

  const acceptInvitation = useMutation(
    api.lists.acceptInvitation.mutationOptions({
      onSuccess: async () => {
        toast({ message: "Invitation accepted" });
        await invalidate();
      },
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );
  const declineInvitation = useMutation(
    api.lists.declineInvitation.mutationOptions({
      onSuccess: async () => {
        toast({ message: "Invitation declined" });
        await invalidate();
      },
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );

  if (isPending) {
    return <FullPageSpinner />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: "List Invitations",
          headerBackTitle: "Back",
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-3 p-4"
      >
        {!invitations || invitations.length === 0 ? (
          <View className="rounded-xl border border-border bg-card p-5">
            <Text className="text-center text-muted-foreground">
              You have no pending list invitations.
            </Text>
          </View>
        ) : (
          invitations.map((invitation) => (
            <View
              key={invitation.id}
              className="gap-3 rounded-xl border border-border bg-card p-4"
            >
              <View className="gap-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-lg font-semibold">
                    {invitation.list.icon} {invitation.list.name}
                  </Text>
                  <Text className="rounded-md bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
                    {invitation.role}
                  </Text>
                  {invitation.recursive && (
                    <Text className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      Nested lists
                    </Text>
                  )}
                  {invitation.expired && (
                    <Text className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      Expired
                    </Text>
                  )}
                </View>
                {invitation.list.owner && (
                  <Text className="text-sm text-muted-foreground">
                    Invited by {invitation.list.owner.name}
                  </Text>
                )}
                {invitation.list.description && (
                  <Text className="text-sm text-muted-foreground">
                    {invitation.list.description}
                  </Text>
                )}
                <Text className="text-xs text-muted-foreground">
                  {invitation.expired ? "Expired" : "Expires"}{" "}
                  {invitationDateFormatter.format(invitation.expiresAt)}
                </Text>
                {invitation.expired && (
                  <Text className="text-xs text-muted-foreground">
                    Ask the owner to resend this invitation to renew it for 30
                    days.
                  </Text>
                )}
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    variant="secondary"
                    disabled={
                      invitation.expired ||
                      declineInvitation.isPending ||
                      acceptInvitation.isPending
                    }
                    onPress={() =>
                      declineInvitation.mutate({
                        invitationId: invitation.id,
                      })
                    }
                  >
                    <Text>Decline</Text>
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    disabled={
                      invitation.expired ||
                      acceptInvitation.isPending ||
                      declineInvitation.isPending
                    }
                    onPress={() =>
                      acceptInvitation.mutate({
                        invitationId: invitation.id,
                      })
                    }
                  >
                    <Text>Accept</Text>
                  </Button>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}
