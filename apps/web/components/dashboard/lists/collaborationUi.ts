export function invitationDeliveryMessage(emailSent: boolean) {
  return emailSent
    ? "Invitation created and email sent."
    : "Invitation created, but the email was not sent. You can resend it later.";
}

export function canManageCollaboratorOnList(collaborator: {
  status: "pending" | "accepted" | "declined";
  inherited?: boolean;
}) {
  return collaborator.status === "accepted" && !collaborator.inherited;
}

export function collaboratorRemovalMessage(name: string) {
  return `Remove ${name} from this shared list? Bookmark entries they contributed through this collaboration will be removed from this shared list, but their underlying bookmarks will remain in their library.`;
}
