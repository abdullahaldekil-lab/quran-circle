import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageCircle } from "lucide-react";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

interface WhatsappButtonProps {
  phone?: string | null;
  message?: string;
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  onSent?: () => void;
}

/** زر يفتح محادثة واتساب جاهزة، ويعطّل نفسه عند غياب رقم صالح. */
const WhatsappButton = ({
  phone,
  message,
  label = "واتساب",
  size = "sm",
  variant = "outline",
  className,
  onSent,
}: WhatsappButtonProps) => {
  const link = buildWhatsappLink(phone, message);
  const iconOnly = size === "icon";

  const button = (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={!link}
      aria-label={link ? `${label} — فتح محادثة واتساب` : "لا يوجد رقم مسجّل"}
      className={cn(
        link && "text-[hsl(142_70%_35%)] border-[hsl(142_40%_60%)] hover:bg-[hsl(142_70%_35%/0.1)]",
        className,
      )}
      onClick={() => {
        if (!link) return;
        window.open(link, "_blank", "noopener,noreferrer");
        onSent?.();
      }}
    >
      <MessageCircle className={cn("w-4 h-4", !iconOnly && "ml-1")} />
      {!iconOnly && label}
    </Button>
  );

  if (link) return button;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent>لا يوجد رقم مسجّل</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default WhatsappButton;
