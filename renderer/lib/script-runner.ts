export interface TestResultItem {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

export interface ScriptExecutionOutput {
  logs: string[];
  testResults: TestResultItem[];
  environmentUpdates: Record<string, string>;
  error?: string;
}

// Lightweight assertion library mimicking Chai / Postman expect
function createExpect(actual: any) {
  return {
    to: {
      equal(expected: any) {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
      },
      deep: {
        equal(expected: any) {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`);
          }
        },
      },
      be: {
        a(expectedType: string) {
          const type = Array.isArray(actual) ? 'array' : typeof actual;
          if (type !== expectedType) {
            throw new Error(`Expected type ${expectedType} but got ${type}`);
          }
        },
        an(expectedType: string) {
          return this.a(expectedType);
        },
        below(val: number) {
          if (Number(actual) >= val) {
            throw new Error(`Expected ${actual} to be below ${val}`);
          }
        },
        above(val: number) {
          if (Number(actual) <= val) {
            throw new Error(`Expected ${actual} to be above ${val}`);
          }
        },
        ok() {
          if (!actual) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
          }
        },
      },
      have: {
        status(expectedStatus: number) {
          if (actual !== expectedStatus) {
            throw new Error(`Expected status code ${expectedStatus} but got ${actual}`);
          }
        },
        property(propName: string) {
          if (!actual || typeof actual !== 'object' || !(propName in actual)) {
            throw new Error(`Expected object to have property "${propName}"`);
          }
        },
      },
      include(expectedSub: any) {
        if (typeof actual === 'string') {
          if (!actual.includes(String(expectedSub))) {
            throw new Error(`Expected "${actual}" to include "${expectedSub}"`);
          }
        } else if (Array.isArray(actual)) {
          if (!actual.includes(expectedSub)) {
            throw new Error(`Expected array to include ${JSON.stringify(expectedSub)}`);
          }
        } else if (actual && typeof actual === 'object') {
          if (!(expectedSub in actual)) {
            throw new Error(`Expected object to include key "${expectedSub}"`);
          }
        }
      },
    },
  };
}

// 1. Run Pre-request Script
export function runPreRequestScript(
  script: string,
  variables: Record<string, string> = {}
): { updatedVariables: Record<string, string>; logs: string[]; error?: string } {
  if (!script || !script.trim()) {
    return { updatedVariables: {}, logs: [] };
  }

  const logs: string[] = [];
  const currentVars = { ...variables };
  const updatedVariables: Record<string, string> = {};

  const sandboxConsole = {
    log: (...args: any[]) => logs.push(args.map(formatLogArg).join(' ')),
    info: (...args: any[]) => logs.push(args.map(formatLogArg).join(' ')),
    warn: (...args: any[]) => logs.push('[WARN] ' + args.map(formatLogArg).join(' ')),
    error: (...args: any[]) => logs.push('[ERROR] ' + args.map(formatLogArg).join(' ')),
  };

  const pm = {
    environment: {
      get(key: string) {
        return currentVars[key];
      },
      set(key: string, value: any) {
        const valStr = String(value);
        currentVars[key] = valStr;
        updatedVariables[key] = valStr;
      },
      unset(key: string) {
        delete currentVars[key];
        delete updatedVariables[key];
      },
    },
    variables: {
      get(key: string) {
        return currentVars[key];
      },
      set(key: string, value: any) {
        const valStr = String(value);
        currentVars[key] = valStr;
        updatedVariables[key] = valStr;
      },
    },
  };

  try {
    const fn = new Function('pm', 'console', script);
    fn(pm, sandboxConsole);
    return { updatedVariables, logs };
  } catch (err: any) {
    logs.push(`[Script Error] ${err.message}`);
    return { updatedVariables, logs, error: err.message };
  }
}

// 2. Run Post-response Test Script
export function runTestScript(
  script: string,
  response: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: any;
    durationMs?: number;
  },
  variables: Record<string, string> = {}
): ScriptExecutionOutput {
  if (!script || !script.trim()) {
    return { logs: [], testResults: [], environmentUpdates: {} };
  }

  const logs: string[] = [];
  const testResults: TestResultItem[] = [];
  const currentVars = { ...variables };
  const environmentUpdates: Record<string, string> = {};

  const sandboxConsole = {
    log: (...args: any[]) => logs.push(args.map(formatLogArg).join(' ')),
    info: (...args: any[]) => logs.push(args.map(formatLogArg).join(' ')),
    warn: (...args: any[]) => logs.push('[WARN] ' + args.map(formatLogArg).join(' ')),
    error: (...args: any[]) => logs.push('[ERROR] ' + args.map(formatLogArg).join(' ')),
  };

  const pmResponse = {
    code: response.status || 0,
    status: response.status || 0,
    statusText: response.statusText || '',
    responseTime: response.durationMs || 0,
    headers: response.headers || {},
    json() {
      if (typeof response.body === 'object' && response.body !== null) {
        return response.body;
      }
      return JSON.parse(String(response.body));
    },
    text() {
      if (typeof response.body === 'string') return response.body;
      return JSON.stringify(response.body, null, 2);
    },
    to: {
      have: {
        status(code: number) {
          if (response.status !== code) {
            throw new Error(`Expected status ${code} but got ${response.status}`);
          }
        },
      },
    },
  };

  const pm = {
    test(testName: string, testFn: () => void) {
      try {
        testFn();
        testResults.push({
          id: Math.random().toString(36).slice(2),
          name: testName,
          passed: true,
        });
      } catch (err: any) {
        testResults.push({
          id: Math.random().toString(36).slice(2),
          name: testName,
          passed: false,
          error: err.message || String(err),
        });
      }
    },
    expect: createExpect,
    response: pmResponse,
    environment: {
      get(key: string) {
        return currentVars[key];
      },
      set(key: string, value: any) {
        const valStr = String(value);
        currentVars[key] = valStr;
        environmentUpdates[key] = valStr;
      },
      unset(key: string) {
        delete currentVars[key];
        delete environmentUpdates[key];
      },
    },
    variables: {
      get(key: string) {
        return currentVars[key];
      },
      set(key: string, value: any) {
        const valStr = String(value);
        currentVars[key] = valStr;
        environmentUpdates[key] = valStr;
      },
    },
  };

  try {
    const fn = new Function('pm', 'console', script);
    fn(pm, sandboxConsole);
    return { logs, testResults, environmentUpdates };
  } catch (err: any) {
    logs.push(`[Script Runtime Error] ${err.message}`);
    return {
      logs,
      testResults,
      environmentUpdates,
      error: err.message,
    };
  }
}

function formatLogArg(arg: any): string {
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}
