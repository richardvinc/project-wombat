local reservedUserKey = KEYS[1]
local reservationKey = KEYS[2]
local paidUserKey = KEYS[3]
local expirySetKey = KEYS[4]

local reservationId = ARGV[1]
local userId = ARGV[2]

if redis.call("EXISTS", paidUserKey) == 1 then
  return "ALREADY_PAID"
end

local currentReservationId = redis.call("GET", reservedUserKey)

if not currentReservationId then
  return "NO_RESERVATION"
end

if currentReservationId ~= reservationId then
  return "RESERVATION_MISMATCH"
end

if redis.call("EXISTS", reservationKey) == 0 then
  return "RESERVATION_EXPIRED"
end

redis.call("SET", paidUserKey, "1")
redis.call("DEL", reservedUserKey)
redis.call("DEL", reservationKey)
redis.call("ZREM", expirySetKey, userId)

return "PAID"
