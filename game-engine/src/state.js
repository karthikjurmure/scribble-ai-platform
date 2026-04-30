// Shared in-memory state
// In a real microservice, this would be in Redis, but we use in-memory 
// for performance with Redis as a backup for history.

const rooms = {};
const users = {};

module.exports = { rooms, users };
