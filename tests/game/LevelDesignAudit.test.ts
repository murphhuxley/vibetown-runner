import { describe, expect, it } from 'vitest';
import { auditLevelDesign, getBlockingDesignIssues } from '@/game/LevelDesignAudit';
import { LEVEL_VARIANT_SLOTS } from '@/levels/catalog';

function getAllVariants() {
  return LEVEL_VARIANT_SLOTS.flatMap((slot) => slot);
}

const auditEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

describe('Level design audit', () => {
  it('can print a compact campaign report for manual curation', () => {
    if (!auditEnv.PRINT_LEVEL_AUDIT) return;

    const rows = getAllVariants().map((level) => {
      const report = auditLevelDesign(level);
      return {
        id: level.id,
        badges: report.metrics.badgeCount,
        ducks: report.metrics.duckCount,
        floors: report.metrics.playableFloorRows.join('/'),
        ladders: report.metrics.ladderColumns.length,
        ropes: report.metrics.ropeSpanCount,
        dig: report.metrics.digOpportunityCount,
        branch: report.metrics.branchScore,
        warnings: report.issues.filter((issue) => issue.severity !== 'blocker').length,
      };
    });

    console.table(rows);

    if (auditEnv.PRINT_LEVEL_AUDIT_DETAILS) {
      for (const level of getAllVariants()) {
        const report = auditLevelDesign(level);
        const issues = report.issues.filter((issue) => issue.severity !== 'blocker');
        if (issues.length === 0) continue;

        console.log(`Level ${level.id}:`);
        for (const issue of issues) {
          const at = typeof issue.x === 'number' && typeof issue.y === 'number'
            ? ` @ ${issue.x},${issue.y}`
            : '';
          console.log(`  ${issue.severity} ${issue.code}${at}: ${issue.message}`);
        }
      }
    }
  });

  it('keeps every curated variant free of blocking design issues', () => {
    const blockers = getAllVariants().flatMap((level) => (
      getBlockingDesignIssues(level).map((issue) => ({ level: level.id, ...issue }))
    ));

    expect(blockers).toEqual([]);
  });

  it('keeps rope routes clear enough for the hanging sprite', () => {
    const crampedRopes = getAllVariants().flatMap((level) => {
      const report = auditLevelDesign(level);
      return report.issues
        .filter((issue) => issue.code === 'rope-body-cramped' || issue.code === 'rope-body-blocked')
        .map((issue) => ({ level: level.id, ...issue }));
    });

    expect(crampedRopes).toEqual([]);
  });

  it('keeps later levels from becoming flat money-collection lanes', () => {
    for (const level of getAllVariants().filter((candidate) => candidate.id >= 8)) {
      const report = auditLevelDesign(level);

      expect(
        report.metrics.badgeRows.length,
        `level ${level.id} should spread money bags across multiple floor bands`,
      ).toBeGreaterThanOrEqual(3);

      expect(
        report.metrics.branchScore,
        `level ${level.id} needs enough route choices to feel like Lode Runner`,
      ).toBeGreaterThanOrEqual(6);
    }
  });

  it('keeps the campaign pressure curve readable instead of simply meaner', () => {
    for (const level of getAllVariants()) {
      const report = auditLevelDesign(level);
      const maxDucks = level.id <= 5 ? 1 : level.id < 14 ? 2 : level.id < 20 ? 3 : 4;

      expect(
        report.metrics.duckCount,
        `level ${level.id} should build duck pressure gradually`,
      ).toBeLessThanOrEqual(maxDucks);
    }
  });
});
