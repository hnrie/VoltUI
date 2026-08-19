import { call } from "./invoke";
export const sessionApi = {
  completeSessionTokenResponse: (requestId: string, sessionToken: string, sessionRefreshToken: string) =>
    call("complete_session_token_response", { requestId, sessionToken, sessionRefreshToken }),
};
export const updaterApi = {
  checkWithDomains: (endpoints: string[], timeoutMs: number) => call("check_update_with_domains", { endpoints, timeoutMs }),
};
