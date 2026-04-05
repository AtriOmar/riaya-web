export function RingLoader({
	className = "",
	...props
}: React.ComponentProps<"div">) {
	return <div className={`ring-loader ${className}`} {...props} />;
}

export function CubeLoader({
	className = "",
	...props
}: React.ComponentProps<"div">) {
	return (
		<div className={`cube ${className}`} {...props}>
			<div className="cube_item cube_x" />
			<div className="cube_item cube_y" />
			<div className="cube_item cube_y" />
			<div className="cube_item cube_x" />
		</div>
	);
}
