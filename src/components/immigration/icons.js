import { createElement } from "react";
import {
  ArrowRight,
  FileCheck2,
  Ticket,
  Zap,
  Heart,
  Home,
  Users,
  Briefcase,
  Clock,
  FileText,
  FileCheck,
  ShieldCheck,
  IdCard,
  Landmark,
  Gavel,
  MessageCircle,
  Plane,
  Calendar,
  AlertTriangle,
  Scale,
  Globe,
  ClipboardCheck,
  UserCheck,
  Building2,
  GraduationCap,
  HelpCircle,
  Award,
  FileSearch,
  Upload,
  Stamp,
  Headset,
  Palmtree,
  Compass,
  Mountain,
} from "lucide-react";

// Outline briefcase used on the homepage 9G card (not a lucide icon).
function BriefcaseOutline({ size = 24, ...props }) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", ...props },
    createElement("rect", { x: "3", y: "7", width: "18", height: "13", rx: "2" }),
    createElement("path", { d: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" })
  );
}

// String-keyed icon registry so service configuration data can reference
// icons by name instead of importing lucide components directly.
export const ICONS = {
  heart: Heart,
  home: Home,
  users: Users,
  briefcase: Briefcase,
  clock: Clock,
  "file-text": FileText,
  "file-check": FileCheck,
  "shield-check": ShieldCheck,
  "id-card": IdCard,
  landmark: Landmark,
  gavel: Gavel,
  "message-circle": MessageCircle,
  plane: Plane,
  calendar: Calendar,
  "alert-triangle": AlertTriangle,
  scale: Scale,
  globe: Globe,
  "clipboard-check": ClipboardCheck,
  "user-check": UserCheck,
  building: Building2,
  "graduation-cap": GraduationCap,
  "help-circle": HelpCircle,
  award: Award,
  "file-search": FileSearch,
  upload: Upload,
  stamp: Stamp,
  headset: Headset,
  "palm-tree": Palmtree,
  compass: Compass,
  mountain: Mountain,
  "arrow-right": ArrowRight,
  "file-check-2": FileCheck2,
  ticket: Ticket,
  zap: Zap,
  "briefcase-outline": BriefcaseOutline,
};

export function getIcon(key) {
  return ICONS[key] || HelpCircle;
}
