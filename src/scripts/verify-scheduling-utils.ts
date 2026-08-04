import assert from "assert";
import {
    isRangeWithinWindow,
    parseLegacyTiming,
    rangesOverlap,
} from "../modules/scheduling/scheduling.utils";

assert.deepStrictEqual(parseLegacyTiming("10-7"), {
    start: "10:00",
    end: "19:00",
});
assert.deepStrictEqual(parseLegacyTiming("12-9"), {
    start: "12:00",
    end: "21:00",
});
assert.deepStrictEqual(parseLegacyTiming("8-2"), {
    start: "08:00",
    end: "14:00",
});
assert.deepStrictEqual(parseLegacyTiming("2-9"), {
    start: "14:00",
    end: "21:00",
});

assert.equal(
    isRangeWithinWindow("10:00", "10:30", "10:00", "21:00"),
    true
);
assert.equal(
    isRangeWithinWindow("20:45", "21:15", "10:00", "21:00"),
    false
);

assert.equal(
    rangesOverlap(
        new Date("2026-08-03T10:00:00+05:30"),
        new Date("2026-08-03T10:30:00+05:30"),
        new Date("2026-08-03T10:15:00+05:30"),
        new Date("2026-08-03T10:45:00+05:30")
    ),
    true
);

console.log("scheduling utils OK");
