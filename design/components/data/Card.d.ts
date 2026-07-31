/**
 * @startingPoint section="Components" subtitle="Base surface used by every screen" viewport="700x220"
 */
export interface CardProps { children?: React.ReactNode; padding?: number; }
export declare function Card(props: CardProps): JSX.Element;
export declare function CardHeader(props: { children?: React.ReactNode }): JSX.Element;
export declare function CardTitle(props: { children?: React.ReactNode }): JSX.Element;
export declare function CardDescription(props: { children?: React.ReactNode }): JSX.Element;
export declare function CardContent(props: { children?: React.ReactNode }): JSX.Element;
export declare function CardFooter(props: { children?: React.ReactNode }): JSX.Element;
