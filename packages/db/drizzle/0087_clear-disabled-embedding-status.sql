UPDATE bookmarks
SET embedding_status = NULL
WHERE embedding_status = 'pending';