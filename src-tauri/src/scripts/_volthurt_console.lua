repeat task.wait() until game:IsLoaded()
if _G.__VoltHurt then return end
_G.__VoltHurt = true

if not writefile or not readfile then
    warn("[VoltHurt] Console relay unavailable: writefile not found.")
    return
end

local relayPath = "volthurt_relay.log"

pcall(writefile, relayPath, "")

game:GetService("StarterGui"):SetCore("SendNotification", {
    Title = "VoltHurt",
    Text = "Injected — console relay active.",
    Icon = "rbxassetid://0"
})

local LogService = game:GetService("LogService")

local function clean(s)
    return (s:gsub("\r\n", " "):gsub("\n", " "):gsub("\r", " "))
end

local conn
conn = LogService.MessageOut:Connect(function(msg, msgType)
    if not _G.__VoltHurt then
        conn:Disconnect()
        return
    end
    local level = "RBX"
    if msgType == Enum.MessageType.MessageWarning then level = "WARN"
    elseif msgType == Enum.MessageType.MessageError then level = "ERR" end

    local line = level .. "|" .. clean(msg) .. "\n"
    local ok, existing = pcall(readfile, relayPath)
    pcall(writefile, relayPath, (ok and existing or "") .. line)
end)