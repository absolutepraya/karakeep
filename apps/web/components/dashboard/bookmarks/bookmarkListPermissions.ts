export function canRemoveBookmarkFromList(input: {
  listId: string | undefined;
  listType: "manual" | "smart" | undefined;
  userRole: "owner" | "editor" | "viewer" | "public" | undefined;
}) {
  return Boolean(
    input.listId &&
      input.listType === "manual" &&
      (input.userRole === "owner" || input.userRole === "editor"),
  );
}
