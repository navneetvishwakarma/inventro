export interface NavItem { key: string; label: string; href?: string; count?: number; }
/**
 * @startingPoint section="Components" subtitle="Desktop primary navigation" viewport="700x420"
 */
export interface SidebarProps {
  active?: string;
  onNavigate?: (key: string) => void;
  items?: NavItem[];
  householdName?: string;
}
export declare function Sidebar(props: SidebarProps): JSX.Element;
