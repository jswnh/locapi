import { useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useEnvStore } from '@/stores/env-store';
import { api } from '@/lib/ipc';
import { replaceVariables } from '@/lib/variable-replacer';
import { runPreRequestScript, runTestScript } from '@/lib/script-runner';
import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, RequestSettings } from '@/types/db';
import { useSettingsStore } from '@/stores/settings-store';
import { toast } from 'sonner';

export function useRequestRunner() {
  const { tabs, activeTabId, setTabLoading, setTabResponse } = useWorkspaceStore();
  const { getActiveEnvironment } = useEnvStore();

  const resolveRequest = useCallback(
    (request: ApiRequest): ApiRequest => {
      const env = getActiveEnvironment();
      const vars = env ? env.variables : [];

      // 1. Resolve URL
      const resolvedUrl = replaceVariables(request.url, vars);

      // 2. Resolve Headers
      const resolvedHeaders = request.headers.map((h) => ({
        ...h,
        key: replaceVariables(h.key, vars),
        value: replaceVariables(h.value, vars),
      }));

      // 3. Resolve Params
      const resolvedParams = request.params.map((p) => ({
        ...p,
        key: replaceVariables(p.key, vars),
        value: replaceVariables(p.value, vars),
      }));

      // 4. Resolve Body
      let resolvedBody = { ...request.body };
      if (request.body) {
        resolvedBody.raw = replaceVariables(request.body.raw || '', vars);
        if (request.body.graphql) {
          resolvedBody.graphql = {
            query: replaceVariables(request.body.graphql.query || '', vars),
            variables: replaceVariables(request.body.graphql.variables || '', vars),
          };
        }
        if (request.body.formData) {
          resolvedBody.formData = request.body.formData.map((item) => ({
            ...item,
            key: replaceVariables(item.key, vars),
            value: item.type === 'text' ? replaceVariables(item.value, vars) : item.value,
          }));
        }
        if (request.body.urlEncoded) {
          resolvedBody.urlEncoded = request.body.urlEncoded.map((item) => ({
            ...item,
            key: replaceVariables(item.key, vars),
            value: replaceVariables(item.value, vars),
          }));
        }
      }

      // 5. Resolve Auth
      let resolvedAuth = { ...request.auth };
      if (request.auth.type === 'bearer' && request.auth.bearer) {
        resolvedAuth.bearer = {
          token: replaceVariables(request.auth.bearer.token, vars),
        };
      } else if (request.auth.type === 'basic' && request.auth.basic) {
        resolvedAuth.basic = {
          username: replaceVariables(request.auth.basic.username || '', vars),
          password: replaceVariables(request.auth.basic.password || '', vars),
        };
      } else if (request.auth.type === 'apiKey' && request.auth.apiKey) {
        resolvedAuth.apiKey = {
          ...request.auth.apiKey,
          value: replaceVariables(request.auth.apiKey.value, vars),
        };
      }

      // 6. Merge Global Settings
      const globalSettings = useSettingsStore.getState().settings;
      const timeoutMs = (request.settings?.timeout || globalSettings.requestTimeout || 30) * 1000;
      const resolvedSettings: RequestSettings = {
        timeout: timeoutMs,
        followRedirects: request.settings?.followRedirects ?? true,
        httpVersion: globalSettings.httpVersion,
        maxResponseSizeMb: globalSettings.maxResponseSizeMb,
        disableCookies: globalSettings.disableCookies,
        responseFormatDetection: globalSettings.responseFormatDetection,
      };

      return {
        ...request,
        url: resolvedUrl,
        headers: resolvedHeaders,
        params: resolvedParams,
        body: resolvedBody,
        auth: resolvedAuth,
        settings: resolvedSettings,
      };
    },
    [getActiveEnvironment]
  );

  const execute = useCallback(
    async (targetTabId?: string) => {
      const tabId = targetTabId || activeTabId;
      const targetTab = tabs.find((t) => t.id === tabId);
      if (!targetTab) return;

      const req = targetTab.request;
      if (!req.url.trim()) {
        toast.error('Please enter a request URL');
        return;
      }

      setTabLoading(tabId, true);

      try {
        const env = getActiveEnvironment();

        // 1. Run Pre-request Script if defined
        if (req.scripts?.preRequest?.trim()) {
          const varsMap: Record<string, string> = {};
          if (env) {
            env.variables.forEach((v) => {
              if (v.enabled && v.key) varsMap[v.key] = v.value;
            });
          }
          const { updatedVariables } = runPreRequestScript(req.scripts.preRequest, varsMap);
          if (Object.keys(updatedVariables).length > 0 && env) {
            const nextVars = [...env.variables];
            for (const [k, val] of Object.entries(updatedVariables)) {
              const foundIdx = nextVars.findIndex((v) => v.key === k);
              if (foundIdx !== -1) {
                nextVars[foundIdx] = { ...nextVars[foundIdx], value: val };
              } else {
                nextVars.push({ id: uuidv4(), key: k, value: val, enabled: true });
              }
            }
            await api.environments.update(env.id, { variables: nextVars });
            await useEnvStore.getState().loadEnvironments();
          }
        }

        const resolved = resolveRequest(req);
        const response = await api.engine.execute(resolved);

        // 2. Run Test Script if defined
        let testResults: any[] = [];
        let scriptLogs: string[] = [];
        if (req.scripts?.test?.trim() && !response.error) {
          const currentEnv = getActiveEnvironment();
          const varsMap: Record<string, string> = {};
          if (currentEnv) {
            currentEnv.variables.forEach((v) => {
              if (v.enabled && v.key) varsMap[v.key] = v.value;
            });
          }
          const testOutput = runTestScript(req.scripts.test, response, varsMap);
          testResults = testOutput.testResults;
          scriptLogs = testOutput.logs;

          if (Object.keys(testOutput.environmentUpdates).length > 0 && currentEnv) {
            const nextVars = [...currentEnv.variables];
            for (const [k, val] of Object.entries(testOutput.environmentUpdates)) {
              const foundIdx = nextVars.findIndex((v) => v.key === k);
              if (foundIdx !== -1) {
                nextVars[foundIdx] = { ...nextVars[foundIdx], value: val };
              } else {
                nextVars.push({ id: uuidv4(), key: k, value: val, enabled: true });
              }
            }
            await api.environments.update(currentEnv.id, { variables: nextVars });
            await useEnvStore.getState().loadEnvironments();
          }
        }

        const enrichedResponse = {
          ...response,
          testResults,
          scriptLogs,
        };

        setTabResponse(tabId, enrichedResponse);

        if (response.error) {
          toast.error(response.error);
        } else if (response.status >= 200 && response.status < 400) {
          toast.success(`${response.status} ${response.statusText} (${response.durationMs}ms)`);
        } else {
          toast.warning(`${response.status} ${response.statusText} (${response.durationMs}ms)`);
        }
      } catch (err: any) {
        console.error('Request execution error:', err);
        setTabResponse(tabId, {
          status: 0,
          statusText: 'Execution Error',
          error: err.message || 'Execution failed',
          durationMs: 0,
          sizeBytes: 0,
          headers: {},
          body: null,
          contentType: '',
        });
        toast.error(err.message || 'Failed to execute request');
      }
    },
    [activeTabId, tabs, resolveRequest, setTabLoading, setTabResponse]
  );

  return { execute, resolveRequest };
}
