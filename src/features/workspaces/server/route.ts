import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono"
import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas";
import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, IMAGES_BUCKET_ID, MEMBERS_ID, TASKS_ID, WORKSPACES_ID } from "@/config";
import { ID, Query } from "node-appwrite";
import { MemberRole } from "@/features/members/types";
import { generateInviteCode } from "@/lib/utils";
import { getMember } from "@/features/members/utils";
import { z } from "zod";
import { Workspace } from "../types";
import { TaskStatus } from "@/features/tasks/types";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

const app = new Hono()
    .get("/", sessionMiddleware, async (c) => {
        const user = c.get("user")
        const databases = c.get("databases")

        const members = await databases.listDocuments(
            DATABASE_ID,
            MEMBERS_ID,
            [Query.equal("userId", [user.$id])]
        )

        if (members.total === 0) {
            return c.json({ data: { documents: [], total: 0 } })
        }

        const workspaceIds = members.documents.map((member) => member.workspaceId)

        const workspaces = await databases.listDocuments(
            DATABASE_ID,
            WORKSPACES_ID,
            [
                Query.orderDesc("$createdAt"),
                Query.contains("$id", workspaceIds)
            ]
        )

        return c.json({ data: workspaces })
    })
    .get(
        "/:workspaceId",
        sessionMiddleware,
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId } = c.req.param();

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const workspace = await databases.getDocument<Workspace>(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId,
            );

            return c.json({ data: workspace });
        }
    )
    .get(
        "/:workspaceId/info",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const { workspaceId } = c.req.param();

            const workspace = await databases.getDocument<Workspace>(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId,
            );

            return c.json({
                data: {
                    $id: workspace.$id,
                    name: workspace.name,
                    imageUrl: workspace.imageUrl
                }
            });
        }
    )
    .post(
        "/",
        zValidator("form", createWorkspaceSchema),
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases")
            const storage = c.get("storage")
            const user = c.get("user")

            const { name, image } = c.req.valid("form")

            let uploadedImageUrl: string | undefined;

            if (image instanceof File) {
                const file = await storage.createFile(
                    IMAGES_BUCKET_ID,
                    ID.unique(),
                    image
                )
                uploadedImageUrl =
                    `https://cloud.appwrite.io/v1/storage/buckets/${IMAGES_BUCKET_ID}` +
                    `/files/${file.$id}/view` +
                    `?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`




            }


            const workspace = await databases.createDocument(
                DATABASE_ID,
                WORKSPACES_ID,
                ID.unique(),
                {
                    name,
                    userId: user.$id,
                    imageUrl: uploadedImageUrl,
                    inviteCode: generateInviteCode(8),
                }
            )

            await databases.createDocument(
                DATABASE_ID,
                MEMBERS_ID,
                ID.unique(),
                {
                    userId: user.$id,
                    workspaceId: workspace.$id,
                    role: MemberRole.ADMIN,
                }
            )

            return c.json({ data: workspace })
        }
    )
    .patch(
        "/:workspaceId",
        sessionMiddleware,
        zValidator("form", updateWorkspaceSchema),
        async (c) => {
            const databases = c.get("databases")
            const storage = c.get("storage")
            const user = c.get("user")

            const { workspaceId } = c.req.param()
            const { name, image } = c.req.valid("form")

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id
            })

            if (!member || member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401)
            }

            let uploadedImageUrl: string | undefined;

            if (image instanceof File) {
                const file = await storage.createFile(
                    IMAGES_BUCKET_ID,
                    ID.unique(),
                    image
                )
                uploadedImageUrl =
                    `https://cloud.appwrite.io/v1/storage/buckets/${IMAGES_BUCKET_ID}` +
                    `/files/${file.$id}/view` +
                    `?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`


            } else {
                uploadedImageUrl = image
            }

            const workspace = await databases.updateDocument(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId,
                {
                    name,
                    imageUrl: uploadedImageUrl,
                }
            )

            return c.json({ data: workspace })

        }
    )
    .delete(
        "/:workspaceId",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases")
            const user = c.get("user")

            const { workspaceId } = c.req.param()

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id
            })

            if (!member || member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401)
            }
            //todo:delete members, projects, tasks related to this workspace

            await databases.deleteDocument(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId
            )

            return c.json({ data: { $id: workspaceId } })
        }
    )
    .post(
        "/:workspaceId/reset-invite-code",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases")
            const user = c.get("user")

            const { workspaceId } = c.req.param()

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id
            })

            if (!member || member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401)
            }


            const workspace = await databases.updateDocument(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId,
                {
                    inviteCode: generateInviteCode(8)
                }
            )

            return c.json({ data: workspace })
        }
    )
    .post(
        "/:workspaceId/join",
        sessionMiddleware,
        zValidator("json", z.object({ code: z.string() })),
        async (c) => {
            const { workspaceId } = c.req.param()
            const { code } = c.req.valid("json")
            const databases = c.get("databases")
            const user = c.get("user")


            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id
            })

            if (member) {
                return c.json({ error: "Already a member of this workspace" }, 400)
            }

            const workspace = await databases.getDocument<Workspace>(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId
            )

            if (workspace.inviteCode !== code) {
                return c.json({ error: "Invalid invite code" }, 400)
            }

            const newMember = await databases.createDocument(
                DATABASE_ID,
                MEMBERS_ID,
                ID.unique(),
                {
                    workspaceId,
                    userId: user.$id,
                    role: MemberRole.MEMBER,
                }
            )

            return c.json({ data: newMember })
        }
    )
    .get(
        "/:workspaceId/analytics",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const { workspaceId } = c.req.param();

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const now = new Date();
            const lastMonthEnd = endOfMonth(subMonths(now, 1));

            // ===== TOTAL TASKS =====
            const allTasks = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [Query.equal("workspaceId", workspaceId)]
            );

            const tasksAsOfLastMonth = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
                ]
            );

            const taskCount = allTasks.total;
            const taskDifference = taskCount - tasksAsOfLastMonth.total;

            // ===== ASSIGNED TASKS (for current member only) =====
            const allAssigned = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.equal("assigneeId", member.$id),
                ]
            );

            const assignedAsOfLastMonth = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.equal("assigneeId", member.$id),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
                ]
            );

            const assignedTaskCount = allAssigned.total;
            const assignedTaskDifference =
                assignedTaskCount - assignedAsOfLastMonth.total;

            // ===== INCOMPLETE TASKS =====
            const allIncomplete = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.notEqual("status", TaskStatus.DONE),
                ]
            );

            const incompleteAsOfLastMonth = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.notEqual("status", TaskStatus.DONE),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
                ]
            );

            const incompleteTaskCount = allIncomplete.total;
            const incompleteTaskDifference =
                incompleteTaskCount - incompleteAsOfLastMonth.total;

            // ===== COMPLETED TASKS =====
            const allCompleted = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.equal("status", TaskStatus.DONE),
                ]
            );

            const completedAsOfLastMonth = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.equal("status", TaskStatus.DONE),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
                ]
            );

            const completedTaskCount = allCompleted.total;
            const completedTaskDifference =
                completedTaskCount - completedAsOfLastMonth.total;

            // ===== OVERDUE TASKS =====
            const allOverdue = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.notEqual("status", TaskStatus.DONE),
                    Query.lessThan("dueDate", now.toISOString()),
                ]
            );

            const overdueAsOfLastMonth = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.notEqual("status", TaskStatus.DONE),
                    Query.lessThan("dueDate", now.toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
                ]
            );

            const overdueTaskCount = allOverdue.total;
            const overdueTaskDifference =
                overdueTaskCount - overdueAsOfLastMonth.total;

            return c.json({
                data: {
                    taskCount,
                    taskDifference,
                    assignedTaskCount,
                    assignedTaskDifference,
                    completedTaskCount,
                    completedTaskDifference,
                    incompleteTaskCount,
                    incompleteTaskDifference,
                    overdueTaskCount,
                    overdueTaskDifference,
                },
            });
        }
    )



export default app;