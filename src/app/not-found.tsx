import Image from "next/image";
import Navbar from "@/components/navbar";

export default function notfound() {
	return (
		<>
			<Navbar />
			<div className="flex justify-center items-center min-w-screen min-h-screen">
				<div className="flex sm:flex-row flex-col items-center">
					<div className="flex flex-col items-center">
						<h1 className="font-bold text-slate-900 text-7xl text-center">
							Oops,
						</h1>
						<h2 className="mt-2 font-medium text-slate-900 text-xl text-center">
							We couldn't find the page
							<br />
							you are looking for
						</h2>
					</div>
					<div>
						<Image
							quality={100}
							src="/404.png"
							alt="404 Not Found"
							width={300}
							height={300}
							className="bg-contain"
						/>
					</div>
				</div>
			</div>
		</>
	);
}
