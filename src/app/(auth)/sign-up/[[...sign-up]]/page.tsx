import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center px-4">
      <div className="mb-12">
        <Image
          src="/logo-transparent.png"
          alt="ListWise"
          width={400}
          height={130}
          className="h-32 w-auto drop-shadow-xl"
          priority
        />
      </div>
      <SignUp />
    </div>
  );
}