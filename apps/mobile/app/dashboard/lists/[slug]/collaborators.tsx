import { useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/Button";
import FullPageSpinner from "@/components/ui/FullPageSpinner";
import { Input } from "@/components/ui/Input";
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

function deliveryMessage(emailSent: boolean) {
  return emailSent
    ? "Invitation created and email sent."
    : "Invitation created, but the email was not sent. You can resend it later.";
}

export default function ManageListCollaboratorsPage() {
  const { slug } = useLocalSearchParams();
  const listId = typeof slug === "string" ? slug : "";
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [recursive, setRecursive] = useState(false);

  const { data, isPending } = useQuery(
    api.lists.getCollaborators.queryOptions(
      { listId },
      { enabled: Boolean(listId) },
    ),
  );

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries(
        api.lists.getCollaborators.queryFilter({ listId }),
      ),
      queryClient.invalidateQueries(api.lists.list.pathFilter()),
      queryClient.invalidateQueries(
        api.lists.getPendingInvitations.pathFilter(),
      ),
    ]);

  const addCollaborator = useMutation(
    api.lists.addCollaborator.mutationOptions({
      onSuccess: async (result) => {
        toast({ message: deliveryMessage(result.emailSent) });
        setEmail("");
        setRole("viewer");
        setRecursive(false);
        await invalidate();
      },
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );
  const updateCollaborator = useMutation(
    api.lists.updateCollaborator.mutationOptions({
      onSuccess: invalidate,
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );
  const updateInvitation = useMutation(
    api.lists.updateInvitation.mutationOptions({
      onSuccess: invalidate,
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );
  const resendInvitation = useMutation(
    api.lists.resendInvitation.mutationOptions({
      onSuccess: async (result) => {
        toast({ message: deliveryMessage(result.emailSent) });
        await invalidate();
      },
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );
  const revokeInvitation = useMutation(
    api.lists.revokeInvitation.mutationOptions({
      onSuccess: invalidate,
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );
  const removeCollaborator = useMutation(
    api.lists.removeCollaborator.mutationOptions({
      onSuccess: invalidate,
      onError: (error) =>
        toast({ message: error.message, variant: "destructive" }),
    }),
  );

  if (isPending || !data) {
    return <FullPageSpinner />;
  }

  const visibleCollaborators = data.collaborators.filter(
    (collaborator) => collaborator.status !== "declined",
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: "Manage Collaborators",
          headerBackTitle: "Back",
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 p-4"
      >
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold">Invite collaborator</Text>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="person@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View className="gap-2">
            <Text className="text-sm text-muted-foreground">Role</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  variant={role === "viewer" ? "primary" : "secondary"}
                  onPress={() => setRole("viewer")}
                >
                  <Text>Viewer</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  variant={role === "editor" ? "primary" : "secondary"}
                  onPress={() => setRole("editor")}
                >
                  <Text>Editor</Text>
                </Button>
              </View>
            </View>
          </View>
          <View className="flex-row items-start justify-between gap-4 rounded-lg border border-border p-3">
            <View className="flex-1 gap-1">
              <Text className="font-medium">Also share all nested lists</Text>
              <Text className="text-xs text-muted-foreground">
                Includes current nested lists and lists added or moved here
                later.
              </Text>
            </View>
            <Switch value={recursive} onValueChange={setRecursive} />
          </View>
          <Button
            disabled={addCollaborator.isPending || !email.trim()}
            onPress={() =>
              addCollaborator.mutate({
                listId,
                email: email.trim(),
                role,
                recursive,
              })
            }
          >
            <Text>Send invitation</Text>
          </Button>
        </View>

        <View className="gap-3">
          <Text className="font-semibold">People with access</Text>
          {data.owner && (
            <View className="rounded-xl border border-border bg-card p-4">
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="font-medium">{data.owner.name}</Text>
                  {data.owner.email && (
                    <Text className="text-sm text-muted-foreground">
                      {data.owner.email}
                    </Text>
                  )}
                </View>
                <Text className="text-sm text-muted-foreground">Owner</Text>
              </View>
            </View>
          )}

          {visibleCollaborators.map((collaborator) => {
            const pending = collaborator.status === "pending";
            return (
              <View
                key={collaborator.id}
                className="gap-3 rounded-xl border border-border bg-card p-4"
              >
                <View className="gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="font-medium">
                      {collaborator.user.name}
                    </Text>
                    {pending && (
                      <Text className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {collaborator.expired ? "Expired" : "Pending"}
                      </Text>
                    )}
                    {collaborator.inherited && (
                      <Text className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        Inherited
                      </Text>
                    )}
                    {collaborator.recursive && (
                      <Text className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        Nested lists
                      </Text>
                    )}
                  </View>
                  {collaborator.user.email && (
                    <Text className="text-sm text-muted-foreground">
                      {collaborator.user.email}
                    </Text>
                  )}
                  {collaborator.inherited && collaborator.sourceListName && (
                    <Text className="text-xs text-muted-foreground">
                      Inherited from {collaborator.sourceListName}
                    </Text>
                  )}
                  {pending && collaborator.expiresAt && (
                    <Text className="text-xs text-muted-foreground">
                      {collaborator.expired ? "Expired" : "Expires"}{" "}
                      {invitationDateFormatter.format(collaborator.expiresAt)}
                    </Text>
                  )}
                </View>

                {collaborator.inherited ? (
                  <View className="gap-2">
                    <Text className="text-sm capitalize text-muted-foreground">
                      {collaborator.role}
                    </Text>
                    {collaborator.user.email && (
                      <Button
                        variant="secondary"
                        onPress={() => {
                          setEmail(collaborator.user.email ?? "");
                          setRole(collaborator.role);
                          setRecursive(false);
                        }}
                      >
                        <Text>Override on this list</Text>
                      </Button>
                    )}
                  </View>
                ) : pending ? (
                  <View className="gap-3">
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Button
                          variant={
                            collaborator.role === "viewer"
                              ? "primary"
                              : "secondary"
                          }
                          disabled={collaborator.expired}
                          onPress={() =>
                            updateInvitation.mutate({
                              invitationId: collaborator.id,
                              role: "viewer",
                              recursive: collaborator.recursive,
                            })
                          }
                        >
                          <Text>Viewer</Text>
                        </Button>
                      </View>
                      <View className="flex-1">
                        <Button
                          variant={
                            collaborator.role === "editor"
                              ? "primary"
                              : "secondary"
                          }
                          disabled={collaborator.expired}
                          onPress={() =>
                            updateInvitation.mutate({
                              invitationId: collaborator.id,
                              role: "editor",
                              recursive: collaborator.recursive,
                            })
                          }
                        >
                          <Text>Editor</Text>
                        </Button>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text>Share nested lists</Text>
                      <Switch
                        value={collaborator.recursive}
                        disabled={collaborator.expired}
                        onValueChange={(value) =>
                          updateInvitation.mutate({
                            invitationId: collaborator.id,
                            role: collaborator.role,
                            recursive: value,
                          })
                        }
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Button
                          variant="secondary"
                          onPress={() =>
                            resendInvitation.mutate({
                              invitationId: collaborator.id,
                            })
                          }
                        >
                          <Text>Resend</Text>
                        </Button>
                      </View>
                      <View className="flex-1">
                        <Button
                          variant="destructive"
                          onPress={() =>
                            revokeInvitation.mutate({
                              invitationId: collaborator.id,
                            })
                          }
                        >
                          <Text>Revoke</Text>
                        </Button>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="gap-3">
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Button
                          variant={
                            collaborator.role === "viewer"
                              ? "primary"
                              : "secondary"
                          }
                          onPress={() =>
                            updateCollaborator.mutate({
                              listId,
                              userId: collaborator.userId,
                              role: "viewer",
                              recursive: collaborator.recursive,
                            })
                          }
                        >
                          <Text>Viewer</Text>
                        </Button>
                      </View>
                      <View className="flex-1">
                        <Button
                          variant={
                            collaborator.role === "editor"
                              ? "primary"
                              : "secondary"
                          }
                          onPress={() =>
                            updateCollaborator.mutate({
                              listId,
                              userId: collaborator.userId,
                              role: "editor",
                              recursive: collaborator.recursive,
                            })
                          }
                        >
                          <Text>Editor</Text>
                        </Button>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text>Share nested lists</Text>
                      <Switch
                        value={collaborator.recursive}
                        onValueChange={(value) =>
                          updateCollaborator.mutate({
                            listId,
                            userId: collaborator.userId,
                            role: collaborator.role,
                            recursive: value,
                          })
                        }
                      />
                    </View>
                    <Button
                      variant="destructive"
                      onPress={() =>
                        Alert.alert(
                          "Remove collaborator?",
                          `Remove ${collaborator.user.name} from this shared list? Bookmark entries they contributed through this collaboration will be removed from this shared list, but their underlying bookmarks will remain in their library.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () =>
                                removeCollaborator.mutate({
                                  listId,
                                  userId: collaborator.userId,
                                }),
                            },
                          ],
                        )
                      }
                    >
                      <Text>Remove collaborator</Text>
                    </Button>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}
