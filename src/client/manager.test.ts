import { describe, expect, it, vi } from "vitest";

import { StreamManager } from "./manager";
import type { StreamCallbacks, StreamConnection } from "./stream";

const fakeConnection = () => ({ open: vi.fn(), close: vi.fn() });

describe("StreamManager", () => {
  it("opens one connection for multiple subscribers of the same key", () => {
    const mgr = new StreamManager();
    const created: StreamCallbacks[] = [];
    const conns: ReturnType<typeof fakeConnection>[] = [];
    const create = (cb: StreamCallbacks) => {
      created.push(cb);
      const c = fakeConnection();
      conns.push(c);
      return c as unknown as StreamConnection;
    };

    mgr.subscribe("k", create, {});
    mgr.subscribe("k", create, {});

    expect(created).toHaveLength(1);
    expect(conns[0].open).toHaveBeenCalledTimes(1);
  });

  it("fans out snapshots and hydrates late joiners", () => {
    const mgr = new StreamManager();
    let cb!: StreamCallbacks;
    const create = (c: StreamCallbacks) => {
      cb = c;
      return fakeConnection() as unknown as StreamConnection;
    };

    const first = { onSnapshot: vi.fn() };
    mgr.subscribe("k", create, first);
    cb.onSnapshot({ a: 1 });
    expect(first.onSnapshot).toHaveBeenCalledWith({ a: 1 });

    const late = { onSnapshot: vi.fn() };
    mgr.subscribe("k", create, late);
    expect(late.onSnapshot).toHaveBeenCalledWith({ a: 1 });
  });

  it("closes the connection after the last subscriber leaves", async () => {
    const mgr = new StreamManager(0);
    let conn!: ReturnType<typeof fakeConnection>;
    const create = () => {
      conn = fakeConnection();
      return conn as unknown as StreamConnection;
    };

    const unsubFirst = mgr.subscribe("k", create, {});
    const unsubSecond = mgr.subscribe("k", create, {});

    unsubFirst();
    expect(conn.close).not.toHaveBeenCalled();

    unsubSecond();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(conn.close).toHaveBeenCalledTimes(1);
  });
});
