local slotsKey = KEYS[1]
local reservedUserKey = KEYS[2]
local reservationKey = KEYS[3]
local paidUserKey = KEYS[4]
local expirySetKey = KEYS[5]
local cooldownKey = KEYS[6]

local reservationId = ARGV[1]
local userId = ARGV[2]
local cooldownSeconds = tonumber(ARGV[3])

if redis.call("EXISTS", paidUserKey) == 1 then
  redis.call("ZREM", expirySetKey, userId)
  return "ALREADY_PAID"
end

local currentReservationId = redis.call("GET", reservedUserKey)

if not currentReservationId then
  local removedExpiry = redis.call("ZREM", expirySetKey, userId)

  if removedExpiry == 1 then
    redis.call("INCR", slotsKey)
    redis.call("SET", cooldownKey, "1", "EX", cooldownSeconds)
    return "RELEASED_EXPIRED"
  end

  return "NO_RESERVATION"
end

if currentReservationId ~= reservationId then
  return "RESERVATION_MISMATCH"
end

redis.call("DEL", reservedUserKey)
redis.call("DEL", reservationKey)
redis.call("ZREM", expirySetKey, userId)
redis.call("INCR", slotsKey)
redis.call("SET", cooldownKey, "1", "EX", cooldownSeconds)

return "RELEASED"
