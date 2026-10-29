// The data contract between the browser bundle and the database. Bump it in
// the same PR as a database change that an older bundle cannot survive (a
// dropped index it upserts against, a new rule its writes break). Open tabs
// and installed apps on an older bundle then see a higher number from
// /api/version and reload onto the new one (StaleBuildReload).
export const CLIENT_DATA_VERSION = 1
