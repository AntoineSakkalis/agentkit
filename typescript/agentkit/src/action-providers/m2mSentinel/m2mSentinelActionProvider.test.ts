import { m2mSentinelActionProvider, M2MSentinelActionProvider } from "./m2mSentinelActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

describe("M2MSentinelActionProvider", () => {
  let provider: M2MSentinelActionProvider;
  let mockWallet: EvmWalletProvider;

  beforeEach(() => {
    jest.restoreAllMocks();
    provider = m2mSentinelActionProvider({
      baseUrl: "http://127.0.0.1:3000",
      apiKey: "local-test-api-key",
    });
    mockWallet = {} as unknown as EvmWalletProvider;
  });

  it("should have the correct provider name", () => {
    expect(provider.name).toBe("m2m_sentinel");
  });

  it("should support Base networks", () => {
    const baseMainnet: Network = {
      protocolFamily: "evm",
      chainId: "8453",
      networkId: "base-mainnet",
    };
    const baseSepolia: Network = {
      protocolFamily: "evm",
      chainId: "84532",
      networkId: "base-sepolia",
    };
    const solana: Network = {
      protocolFamily: "svm",
      chainId: "solana",
      networkId: "solana",
    };

    expect(provider.supportsNetwork(baseMainnet)).toBe(true);
    expect(provider.supportsNetwork(baseSepolia)).toBe(true);
    expect(provider.supportsNetwork(solana)).toBe(false);
  });

  it("should expose all 4 actions", () => {
    const actions = provider.getActions(mockWallet);
    expect(actions).toHaveLength(4);

    const actionNames = actions.map(action => action.name);
    expect(actionNames).toContain("M2MSentinelActionProvider_audit_contract");
    expect(actionNames).toContain("M2MSentinelActionProvider_get_gas_metrics");
    expect(actionNames).toContain("M2MSentinelActionProvider_get_token_price");
    expect(actionNames).toContain("M2MSentinelActionProvider_get_service_status");
  });

  it("should return audit observations from a mocked API response", async () => {
    const address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const mockAudit = {
      address,
      proxyResolution: { isProxy: true },
      provenance: { trustLevel: "HIGH_TRUST_PRIMARY" },
    };
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAudit,
    } as Response);

    const result = await provider.auditContract(mockWallet, { address });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("SUCCESS");
    expect(parsed.notASafetyGuarantee).toBe(true);
    expect(parsed.data.address).toBe(address);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/v1/audit/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "local-test-api-key",
        }),
      }),
    );
  });

  it("should report 402 without claiming to expose or settle an x402 challenge", async () => {
    const address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 402,
    } as Response);

    const result = await provider.auditContract(mockWallet, { address });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("PAYMENT_REQUIRED");
    expect(parsed.message).toContain("does not expose the challenge or settle payment");
    expect(parsed.notASafetyGuarantee).toBe(true);
  });
});
