/**
 * MIME type used in HTML5 drag-and-drop dataTransfer to identify
 * bookmark card drags (as opposed to file drops).
 */
export const BOOKMARK_DRAG_MIME = "application/x-karakeep-bookmark";

/**
 * MIME type carrying the id of the manual list the dragged bookmark is being
 * viewed in (its "source" list), when any. Lets a drop target turn a copy into
 * a move by removing the bookmark from this source list. Absent when dragging
 * from a non-list view (all bookmarks, favourites, tags, search, …).
 */
export const BOOKMARK_SOURCE_LIST_MIME = "application/x-karakeep-source-list";
