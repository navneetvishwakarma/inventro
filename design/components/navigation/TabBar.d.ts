/**
 * @startingPoint section="Components" subtitle="Mobile bottom tab bar with center Add action" viewport="390x64"
 */
export interface TabBarItem { key: string; label: string; href?: string; }
export interface TabBarProps {
  active?: string;
  onNavigate?: (key: string) => void;
  items?: TabBarItem[];
}
export declare function TabBar(props: TabBarProps): JSX.Element;
