// Run once after mongod starts with --replSet (see docker-compose.yml).
// Idempotent: safe if replica set already exists.
try {
  const s = rs.status()
  if (s.ok) {
    print('replica set already initialized')
    quit(0)
  }
} catch (e) {
  // not yet initialized
}
// Use 127.0.0.1 so Node/Prisma on the host (DATABASE_URL with localhost) matches RS hostnames.
// The mongo-init job connects via mongodb://mongodb:27017, but the advertised member must be
// reachable from wherever Prisma runs; Docker only publishes 27017 on the host as 127.0.0.1.
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: '127.0.0.1:27017' }],
})
