export default function printSnapshotInfo(snapshot, label) {
  const date = new Date(snapshot.date);

  console.log(
    '',
    `${label}:`,
    date.toLocaleDateString(),
    date.toLocaleTimeString(),
    '•',
    snapshot.project,
    '•',
    snapshot.gitRef,
  );
}
