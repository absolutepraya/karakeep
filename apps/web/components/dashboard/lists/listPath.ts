interface ListPathSegment {
  icon: string;
  name: string;
}

export function truncateListPath(path: readonly ListPathSegment[]) {
  const visiblePath = path.length > 2 ? path.slice(-2) : path;
  return [
    ...(path.length > 2 ? ["…"] : []),
    ...visiblePath.map((list) => `${list.icon} ${list.name}`),
  ].join(" / ");
}
