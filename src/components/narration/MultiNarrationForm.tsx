import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { NarrationRange } from "./NarrationValidation";
import { SECTION_LIMITS, calcRangeHizbCount, checkOverlap } from "./NarrationValidation";

interface Props {
  ranges: NarrationRange[];
  onChange: (ranges: NarrationRange[]) => void;
  pagesPerHizb: number;
}

type SectionKey = "first_third" | "second_third" | "third_third";

export default function MultiNarrationForm({ ranges, onChange, pagesPerHizb }: Props) {
  const sections: SectionKey[] = ["first_third", "second_third", "third_third"];

  const addRange = (section: SectionKey) => {
    const limits = SECTION_LIMITS[section];
    const newRange: NarrationRange = {
      section,
      from_hizb: limits.min,
      to_hizb: limits.min,
      hizb_count: 1,
    };
    onChange([...ranges, newRange]);
  };

  const removeRange = (index: number) => {
    onChange(ranges.filter((_, i) => i !== index));
  };

  const updateRange = (index: number, updated: Partial<NarrationRange>) => {
    const newRanges = ranges.map((r, i) => {
      if (i !== index) return r;
      const merged = { ...r, ...updated };
      merged.hizb_count = calcRangeHizbCount(merged.from_hizb, merged.to_hizb);
      return merged;
    });
    onChange(newRanges);
  };

  const overlapError = checkOverlap(ranges);

  return (
    <div className="space-y-4">
      {sections.map((sectionKey) => {
        const limits = SECTION_LIMITS[sectionKey];
        const sectionRanges = ranges
          .map((r, i) => ({ ...r, _index: i }))
          .filter((r) => r.section === sectionKey);
        const sectionHizb = sectionRanges.reduce(
          (sum, r) => sum + calcRangeHizbCount(r.from_hizb, r.to_hizb),
          0
        );

        return (
          <div key={sectionKey} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{limits.label}</Label>
              <div className="flex items-center gap-2">
                {sectionHizb > 0 && (
                  <Badge variant="outline" className="text-xs">{sectionHizb} حزب</Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => addRange(sectionKey)}
                >
                  <Plus className="w-3 h-3" /> إضافة نطاق
                </Button>
              </div>
            </div>

            {sectionRanges.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">لا توجد نطاقات</p>
            ) : (
              <div className="space-y-2">
                {sectionRanges.map((r) => (
                  <div key={r._index} className="flex items-center gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <Input
                        type="number"
                        min={limits.min}
                        max={limits.max}
                        placeholder="من"
                        value={r.from_hizb}
                        onChange={(e) =>
                          updateRange(r._index, { from_hizb: Number(e.target.value) })
                        }
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min={limits.min}
                        max={limits.max}
                        placeholder="إلى"
                        value={r.to_hizb}
                        onChange={(e) =>
                          updateRange(r._index, { to_hizb: Number(e.target.value) })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      {calcRangeHizbCount(r.from_hizb, r.to_hizb)} حزب
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeRange(r._index)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {overlapError && (
        <p className="text-xs text-destructive font-medium">{overlapError}</p>
      )}

      {/* Summary */}
      <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
        <Badge variant="default" className="text-xs">
          مجموع: {ranges.reduce((s, r) => s + calcRangeHizbCount(r.from_hizb, r.to_hizb), 0)} حزب
        </Badge>
        <Badge variant="outline" className="text-xs">
          ≈ {ranges.reduce((s, r) => s + calcRangeHizbCount(r.from_hizb, r.to_hizb), 0) * pagesPerHizb} وجه
        </Badge>
      </div>
    </div>
  );
}
