import { apiAuth } from "../middleware/api-auth";
import { db } from "../db";

describe("apiAuth middleware", () => {
  const mockNext = jest.fn();

  afterEach(() => {
    jest.restoreAllMocks();
    mockNext.mockReset();
  });

  test("allows valid API key", async () => {
    jest.spyOn(db.query, "apiKeys").mockImplementation(() => ({
      findFirst: jest.fn().mockResolvedValue({
        id: 1,
        name: "Test Key",
        dealershipId: 2,
        permissions: ["read"],
        isActive: true,
      }),
    }));
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
    jest.spyOn(db.query, "apiKeys").mockImplementation(() => ({
      findFirst: jest.fn().mockResolvedValue(undefined),
    }));

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
});
