# Shared strict-host-key SFTP transport; source from trusted ops scripts only.
: "${BACKUP_SSH_CONFIG:?Set an absolute SSH config path}" "${BACKUP_KNOWN_HOSTS:?Set a pinned known_hosts file}"
[[ $BACKUP_SSH_CONFIG = /* && -r $BACKUP_SSH_CONFIG && $BACKUP_KNOWN_HOSTS =~ ^/[a-zA-Z0-9_./-]+$ && -s $BACKUP_KNOWN_HOSTS ]] || exit 2
remote(){ sftp -q -b - -F "$BACKUP_SSH_CONFIG" -oBatchMode=yes -oStrictHostKeyChecking=yes -oGlobalKnownHostsFile=/dev/null -oUserKnownHostsFile="$BACKUP_KNOWN_HOSTS" -oConnectTimeout=20 -oServerAliveInterval=30 -oServerAliveCountMax=3 rahmani-offsite; }
valid_archive_name(){ [[ $1 =~ ^rahmani-[0-9]{8}T[0-9]{6}Z-[[:alnum:]]+\.dump\.cms$ ]]; }
