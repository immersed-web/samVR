import { THREE } from "aframe";

type Waiter = {
  promise: Promise<void>;
  resolve: () => void;
  // ticksToWait: number;
  resolveAtTickCount: number;
}

export default function () {
  AFRAME.registerComponent('tick-counter', {
    schema: {
    },
    tickCount: 0,
    waiters: undefined as unknown as Waiter[],
    init: function () {
      this.waiters = [];
      console.log('tick-counter init');
      this.waitForTicks = this.waitForTicks.bind(this);
    },
    update: function () {
    },
    tick() {
      this.tickCount++;
      // Loop backwards so we can safely pop as we go along
      this.waiters.reduceRight<null>((acc, waiter) => {
        if (this.tickCount >= waiter.resolveAtTickCount) {
          console.log('waiter tickCount reached. resolving promise');
          waiter.resolve();
          this.waiters.pop();
        }
        return null;
      }, null);

    },
    waitForTicks(ticksToWait: number) {
      let resolve: () => void;
      const p = new Promise<void>(res => {
        resolve = res;
      });
      const resolveAtTickCount = this.tickCount + ticksToWait
      const waiter: Waiter = {
        promise: p,
        resolve: resolve!,
        resolveAtTickCount
      }
      this.waiters.push(waiter);
      this.waiters.sort((a, b) => b.resolveAtTickCount - a.resolveAtTickCount);
      return p;
    }
  });
}