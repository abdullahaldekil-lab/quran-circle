import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { BookOpen, Layers } from "lucide-react";

interface Props {
  value: "regular" | "multi";
  onChange: (v: "regular" | "multi") => void;
}

export default function NarrationTypeSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">نوع السرد</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as "regular" | "multi")}
        className="grid grid-cols-2 gap-3"
        dir="rtl"
      >
        <label
          className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
            value === "regular"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <RadioGroupItem value="regular" id="regular" />
          <BookOpen className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium">سرد منتظم</p>
            <p className="text-xs text-muted-foreground">من حزب إلى حزب متصل</p>
          </div>
        </label>
        <label
          className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
            value === "multi"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <RadioGroupItem value="multi" id="multi" />
          <Layers className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium">سرد متعدد</p>
            <p className="text-xs text-muted-foreground">أحزاب متفرقة من الأثلاث</p>
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}
