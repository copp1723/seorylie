import { apiAuth } from "../middleware/api-auth";
import { db } from "../db";

describe("apiAuth middleware", () => {
  const mockNext = jest.fn();

  afterEach(() => {
    jest.restoreAllMocks();
    mockNext.mockReset();
  });

  test("allows valid API key", async () => {
    (db.query.apiKeys.findFirst as unknown as jest.Mock) = jest
      .fn()
      .mockResolvedValue({
        id: 1,
        name: "Test Key",
        dealershipId: 2,
        permissions: ["read"],
        isActive: true,
      });
    jest.spyOn(db, "update").mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    } as any);

    const req: any = { header: jest.fn().mockReturnValue("valid") };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await apiAuth()(req, res, mockNext);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.apiClient).toBeDefined();
    expect(req.apiClient.clientName).toBe("Test Key");
    expect(mockNext).toHaveBeenCalled();
  });

  test("rejects invalid API key", async () => {
    (db.query.apiKeys.findFirst as unknown as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);

    const req: any = { header: jest.fn().mockReturnValue("invalid") };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await apiAuth()(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_api_key",
      message: "API key not found or inactive",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("rejects missing API key header", async () => {
    const req: any = { header: jest.fn().mockReturnValue(undefined) };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await apiAuth()(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "missing_api_key",
      message: "API key is required (X-API-Key header)",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("rejects API key without required scope", async () => {
    (db.query.apiKeys.findFirst as unknown as jest.Mock) = jest
      .fn()
      .mockResolvedValue({
        id: 10,
        name: "Limited Key",
        dealershipId: 3,
        permissions: ["read"],
        isActive: true,
      });
    jest.spyOn(db, "update").mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    } as any);

    const req: any = { header: jest.fn().mockReturnValue("limited") };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await apiAuth("write")(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "insufficient_scope",
      message: "API key lacks required permissions",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
