import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { WorkspaceIdJoinClient } from "./client";

interface Props {
  params: {
    workspaceId: string;
    inviteCode: string;
  };
}

const WorkspaceIdJoinPage = async ({ params }: Props) => {
  const user = await getCurrent();

  if (!user) {
    redirect(
      `/sign-in?redirect=${encodeURIComponent(
        `/workspaces/${params.workspaceId}/join/${params.inviteCode}`
      )}`
    );
  }

  return <WorkspaceIdJoinClient />;
};

export default WorkspaceIdJoinPage;