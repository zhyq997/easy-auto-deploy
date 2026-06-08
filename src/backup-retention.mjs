const DEFAULT_BACKUP_LIMIT = 5;

export function getBackupsToDelete(
  backups,
  limit = DEFAULT_BACKUP_LIMIT
) {
  return backups
    .filter((file) => file.toLowerCase().endsWith(".zip"))
    .slice(limit);
}
