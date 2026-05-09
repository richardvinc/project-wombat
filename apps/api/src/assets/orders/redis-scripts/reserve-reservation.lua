local slotsKey = KEYS[1]
local reservedUserKey = KEYS[2]
local reservationKey = KEYS[3]
local paidUserKey = KEYS[4]
local cooldownKey = KEYS[5]
local expirySetKey = KEYS[6]

local reservationId = ARGV[1]
local reservationJson = ARGV[2]
local ttlSeconds = tonumber(ARGV[3])
local expiresAtTimestampMs = tonumber(ARGV[4])
local userId = ARGV[5]

if redis.call("EXISTS", paidUserKey) == 1 then
  return "ALREADY_PAID"
end

if redis.call("EXISTS", cooldownKey) == 1 then
  return "COOLDOWN_ACTIVE"
end

if redis.call("EXISTS", reservedUserKey) == 1 then
  return "ALREADY_RESERVED"
end

local slots = tonumber(redis.call("GET", slotsKey) or "0")

if slots <= 0 then
  return "QUEUE_FULL"
end

redis.call("DECR", slotsKey)
redis.call("SET", reservedUserKey, reservationId, "EX", ttlSeconds)
redis.call("SET", reservationKey, reservationJson, "EX", ttlSeconds)
redis.call("ZADD", expirySetKey, expiresAtTimestampMs, userId)

return "RESERVED"
