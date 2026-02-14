import Image from "next/image";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ProjectAvatarProps {
    image?: string;
    name: string;
    className?: string;
    fallbackClassname?:string;
}

export const ProjectAvatar = ({
    image,
    name,
    className,
    fallbackClassname,
}: ProjectAvatarProps) => {
    if (image) {
        return (
            <div className={cn(
                "size-5 relative rounded-md overflow-hidden",
                className,
            )}>
                <Image
                    src={image}
                    alt={name}
                    fill
                    unoptimized
                    className="object-cover"
                />

            </div>

        );
    }
    return (
        <Avatar className={cn("size-5 rounded-md", className)}>
            <AvatarFallback className={cn(
                "text-white bg-blue-600 font-semibold text-sm uppercase rounded-md",
                 fallbackClassname,
                )}>
                {name.charAt(0)}
            </AvatarFallback>
        </Avatar>
    );
};
