import { Alert, Platform, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useBookmarkListLayoutMenu } from "@/components/bookmarks/BookmarkListHeader";
import UpdatingBookmarkList from "@/components/bookmarks/UpdatingBookmarkList";
import FullPageError from "@/components/FullPageError";
import FullPageSpinner from "@/components/ui/FullPageSpinner";
import { Text } from "@/components/ui/Text";
import { useArchiveFilter } from "@/lib/hooks";
import { useColorScheme } from "@/lib/useColorScheme";
import { useMenuIconColors } from "@/lib/useMenuIconColors";
import { MenuView } from "@react-native-menu/menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, Ellipsis } from "lucide-react-native";

import { useBookmarkLists } from "@karakeep/shared-react/hooks/lists";
import { useTRPC } from "@karakeep/shared-react/trpc";
import { ZBookmarkList } from "@karakeep/shared/types/lists";

export default function ListView() {
  const { slug } = useLocalSearchParams();
  const api = useTRPC();
  const { colors } = useColorScheme();
  if (typeof slug !== "string") {
    throw new Error("Unexpected param type");
  }
  const {
    data: list,
    error,
    refetch,
  } = useQuery(api.lists.get.queryOptions({ listId: slug }));
  const { data: listsData } = useBookmarkLists();
  const hierarchyPath = listsData?.getPathById(slug);
  const parentList =
    hierarchyPath && hierarchyPath.length > 1
      ? hierarchyPath[hierarchyPath.length - 2]
      : undefined;
  const { archived, isLoading: isSettingsLoading } = useArchiveFilter();

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: list ? `${list.icon} ${list.name}` : "",
          headerBackTitle: parentList?.name ?? "Back",
          headerBackVisible: !parentList,
          headerLeft: parentList
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  className="flex max-w-48 flex-row items-center"
                  hitSlop={4}
                  style={{ minHeight: 48, minWidth: 48 }}
                  onPress={() => {
                    router.replace({
                      pathname: "/dashboard/lists/[slug]",
                      params: { slug: parentList.id },
                    });
                  }}
                >
                  <ChevronLeft size={22} color={colors.foreground} />
                  <Text className="max-w-40" numberOfLines={1}>
                    {parentList.name}
                  </Text>
                </Pressable>
              )
            : undefined,
          headerRight: () => (
            <ListActionsMenu listId={slug} role={list?.userRole ?? "viewer"} />
          ),
        }}
      />
      {error ? (
        <FullPageError error={error.message} onRetry={() => refetch()} />
      ) : list && !isSettingsLoading ? (
        <UpdatingBookmarkList
          query={{
            listId: list.id,
            archived,
          }}
        />
      ) : (
        <FullPageSpinner />
      )}
    </>
  );
}

function ListActionsMenu({
  listId,
  role,
}: {
  listId: string;
  role: ZBookmarkList["userRole"];
}) {
  const api = useTRPC();
  const { colors } = useColorScheme();
  const { menuIconColor, destructiveMenuIconColor } = useMenuIconColors();
  const { layoutActions, handleLayoutAction } = useBookmarkListLayoutMenu();
  const { mutate: deleteList } = useMutation(
    api.lists.delete.mutationOptions({
      onSuccess: () => {
        router.replace("/dashboard/lists");
      },
    }),
  );

  const { mutate: leaveList } = useMutation(
    api.lists.leaveList.mutationOptions({
      onSuccess: () => {
        router.replace("/dashboard/lists");
      },
    }),
  );

  const handleDelete = () => {
    Alert.alert("Delete List", "Are you sure you want to delete this list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: () => {
          deleteList({ listId });
        },
        style: "destructive",
      },
    ]);
  };

  const handleLeave = () => {
    Alert.alert(
      "Leave List",
      "Leaving removes the direct collaboration grant that gives you access. If this list is inherited from a recursively shared parent, you will leave that parent share and lose access to lists that depend on it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          onPress: () => {
            leaveList({ listId });
          },
          style: "destructive",
        },
      ],
    );
  };

  const handleEdit = () => {
    router.push({
      pathname: "/dashboard/lists/[slug]/edit",
      params: { slug: listId },
    });
  };

  const handleCollaborators = () => {
    router.push({
      pathname: "/dashboard/lists/[slug]/collaborators",
      params: { slug: listId },
    });
  };

  return (
    <MenuView
      actions={[
        ...layoutActions,
        {
          id: "edit",
          title: "Edit List",
          attributes: {
            hidden: role !== "owner",
          },
          image: Platform.select({ ios: "square.and.pencil" }),
          imageColor: Platform.select({ ios: menuIconColor }),
        },
        {
          id: "collaborators",
          title: "Manage Collaborators",
          attributes: {
            hidden: role !== "owner",
          },
          image: Platform.select({ ios: "person.2" }),
          imageColor: Platform.select({ ios: menuIconColor }),
        },
        {
          id: "delete_list",
          title: "Delete List",
          attributes: {
            destructive: true,
            hidden: role !== "owner",
          },
          image: Platform.select({ ios: "trash" }),
          imageColor: Platform.select({ ios: destructiveMenuIconColor }),
        },
        {
          id: "leave",
          title: "Leave List",
          attributes: {
            destructive: true,
            hidden: role === "owner",
          },
          image: Platform.select({ ios: "arrowshape.turn.up.left" }),
          imageColor: Platform.select({ ios: destructiveMenuIconColor }),
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (handleLayoutAction(nativeEvent.event)) {
          return;
        }

        if (nativeEvent.event === "delete_list") {
          handleDelete();
        } else if (nativeEvent.event === "leave") {
          handleLeave();
        } else if (nativeEvent.event === "edit") {
          handleEdit();
        } else if (nativeEvent.event === "collaborators") {
          handleCollaborators();
        }
      }}
      shouldOpenOnLongPress={false}
    >
      <View className="my-auto">
        <Ellipsis
          onPress={() => Haptics.selectionAsync()}
          color={colors.foreground}
        />
      </View>
    </MenuView>
  );
}