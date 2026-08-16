const invitationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatInvitationDate(date: Date) {
  return invitationDateFormatter.format(date);
}

export function canManageCollaboratorOnList(collaborator: {
  status: "pending" | "accepted" | "declined";
  inherited?: boolean;
}) {
  return collaborator.status === "accepted" && !collaborator.inherited;
}
