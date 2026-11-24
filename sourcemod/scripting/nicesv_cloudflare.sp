/**
 * NICE SV | SourceMod SteamWorks HTTP reporter
 * Compile with SourceMod 1.12 + SteamWorks.inc, and install SteamWorks extension.
 * A single polling timer sends server status to Cloudflare, not client data.
 * The token must be supplied in cfg/sourcemod/nicesv_cloudflare.cfg, never GitHub.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <steamworks>

public Plugin myinfo =
{
    name = "NICE SV | Cloudflare Server Monitor",
    author = "NICE SV",
    description = "Reports L4D2 status to the NICE SV Cloudflare Worker",
    version = "1.0.0",
    url = "https://github.com/matiasboy289-sketch/niceshot-monitor"
};

ConVar g_cEnable;
ConVar g_cURL;
ConVar g_cToken;
ConVar g_cInterval;
Handle g_hTimer = null;
bool g_bPending = false;

public void OnPluginStart()
{
    g_cEnable = CreateConVar("nicesv_cf_enable", "0", "Enable Cloudflare monitor reporting", FCVAR_NOTIFY, true, 0.0, true, 1.0);
    g_cURL = CreateConVar("nicesv_cf_url", "https://niceshot-api.matiasboy289.workers.dev/api/status/ingest", "Cloudflare Worker status ingest endpoint", FCVAR_PROTECTED);
    g_cToken = CreateConVar("nicesv_cf_token", "", "Shared secret; configure locally, never commit", FCVAR_PROTECTED);
    g_cInterval = CreateConVar("nicesv_cf_interval", "20.0", "Reporting interval (seconds)", FCVAR_NOTIFY, true, 10.0, true, 90.0);
    AutoExecConfig(true, "nicesv_cloudflare");
    g_cEnable.AddChangeHook(OnCvarChange);
    g_cInterval.AddChangeHook(OnCvarChange);
    g_hTimer = CreateTimer(20.0, TimerReport, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

public void OnCvarChange(ConVar cvar, const char[] oldValue, const char[] newValue)
{
    if (g_hTimer != null)
    {
        delete g_hTimer;
        g_hTimer = null;
    }
    float interval = g_cInterval.FloatValue;
    g_hTimer = CreateTimer(interval, TimerReport, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

public Action TimerReport(Handle timer)
{
    SendReport();
    return Plugin_Continue;
}

public void OnMapStart()
{
    // Timer with NO_MAPCHANGE is recreated for each map.
    if (g_hTimer != null)
    {
        delete g_hTimer;
        g_hTimer = null;
    }
    g_hTimer = CreateTimer(g_cInterval.FloatValue, TimerReport, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

void JsonEscape(const char[] input, char[] output, int maxlen)
{
    int idx = 0;
    for (int i = 0; input[i] != '\0' && idx < maxlen - 7; i++)
    {
        int c = input[i];
        switch (c)
        {
            case '"', '\\':
            {
                output[idx++] = '\\';
                output[idx++] = c;
            }
            case '\n':
            {
                output[idx++] = '\\';
                output[idx++] = 'n';
            }
            case '\r':
            {
                output[idx++] = '\\';
                output[idx++] = 'r';
            }
            case '\t':
            {
                output[idx++] = '\\';
                output[idx++] = 't';
            }
            default:
            {
                if (c >= 0 && c < 32) continue;
                output[idx++] = c;
            }
        }
    }
    output[idx] = '\0';
}

void SendReport()
{
    if (!g_cEnable.BoolValue || g_bPending) return;

    char token[256], url[256];
    g_cToken.GetString(token, sizeof(token));
    g_cURL.GetString(url, sizeof(url));
    if (!token[0] || StrContains(url, "https://", false) != 0)
    {
        LogError("[NICE SV] Configure nicesv_cf_token and an HTTPS URL first");
        return;
    }

    char hostname[128], escapedName[256], map[128], escapedMap[256], game[64];
    FindConVar("hostname").GetString(hostname, sizeof(hostname));
    JsonEscape(hostname, escapedName, sizeof(escapedName));
    GetCurrentMap(map, sizeof(map));
    JsonEscape(map, escapedMap, sizeof(escapedMap));
    strcopy(game, sizeof(game), "Left 4 Dead 2");

    char body[16384];
    FormatEx(body, sizeof(body),
        "{\"name\":\"%s\",\"map\":\"%s\",\"game\":\"%s\",\"players\":0,\"max_players\":%d,\"bots\":0,\"player_list\":[",
        escapedName, escapedMap, game, MaxClients);

    int count = 0, bots = 0, visible = 0;
    for (int i = 1; i <= MaxClients; i++)
    {
        if (!IsClientInGame(i)) continue;
        visible++;
        if (IsFakeClient(i)) bots++;
        else
        {
            char name[128], escaped[256], addition[512];
            GetClientName(i, name, sizeof(name));
            JsonEscape(name, escaped, sizeof(escaped));
            int secs = RoundToFloor(GetClientTime(i));
            FormatEx(addition, sizeof(addition), "%s{\"name\":\"%s\",\"score\":0,\"seconds\":%d}",
                (count > 0 ? "," : ""), escaped, secs);
            if (strlen(body) + strlen(addition) + 8 >= sizeof(body))
                break;
            StrCat(body, sizeof(body), addition);
            count++;
        }
    }
    StrCat(body, sizeof(body), "]}");
    // Replace the placeholder fields without rebuilding the player list.
    char prefix[512], replacement[512];
    FormatEx(prefix, sizeof(prefix),
        "\"players\":0,\"max_players\":%d,\"bots\":0", MaxClients);
    FormatEx(replacement, sizeof(replacement),
        "\"players\":%d,\"max_players\":%d,\"bots\":%d", visible, MaxClients, bots);
    ReplaceString(body, sizeof(body), prefix, replacement);

    Handle req = SteamWorks_CreateHTTPRequest(k_EHTTPMethodPOST, url);
    if (req == null)
    {
        LogError("[NICE SV] Unable to create SteamWorks request");
        return;
    }
    if (!SteamWorks_SetHTTPRequestHeaderValue(req, "X-NiceSV-Token", token)
        || !SteamWorks_SetHTTPRequestRawPostBody(req, "application/json", body, strlen(body))
        || !SteamWorks_SetHTTPCallbacks(req, OnHTTPComplete)
        || !SteamWorks_SendHTTPRequest(req))
    {
        LogError("[NICE SV] Unable to send SteamWorks request");
        delete req;
        return;
    }
    g_bPending = true;
}

public int OnHTTPComplete(Handle request, bool failure, bool requestSuccessful, EHTTPStatusCode statusCode, any data)
{
    g_bPending = false;
    if (failure || !requestSuccessful || view_as<int>(statusCode) < 200 || view_as<int>(statusCode) >= 300)
    {
        LogError("[NICE SV] Cloudflare report failed (status %d)", view_as<int>(statusCode));
    }
    delete request;
    return 0;
}
