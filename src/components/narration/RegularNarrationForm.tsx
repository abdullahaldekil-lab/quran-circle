import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { NarrationRange } from "./NarrationValidation";
import { calcRangeHizbCount } from "./NarrationValidation";

interface Props {
  range: NarrationRange;
  onChange: (range: NarrationRange) => void;
  pagesPerHizb: number;
}

export default function RegularNarrationForm({ range, onChange, pagesPerHizb }: Props) {
  const hizbCount = calcRangeHizbCount(range.from_hizb, range.to_hizb);
  const pages = hizbCount * pagesPerHizb;
  const isValid = range.from_hizb <= range.to_hizb && range.from_hizb >= 1 && range.to_hizb <= 60;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>من حزب</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={range.from_hizb}
            onChange={(e) =>
              onChange({ ...range, from_hizb: Number(e.target.value), hizb_count: calcRangeHizbCount(Number(e.target.value), range.to_hizb) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>إلى حزب</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={range.to_hizb}
            onChange={(e) =>
              onChange({ ...range, to_hizb: Number(e.target.value), hizb_count: calcRangeHizbCount(range.from_hizb, Number(e.target.value)) })
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
        <Badge variant={isValid ? "default" : "destructive"} className="text-xs">
          {hizbCount} حزب
        </Badge>
        <Badge variant="outline" className="text-xs">
          ≈ {pages} وجه
        </Badge>
        {!isValid && (
          <span className="text-xs text-destructive">نطاق غير صحيح</span>
        )}
      </div>
    </div>
  );
}
