import { DATABASE_ID, IMAGES_BUCKET_ID, PROJECTS_ID, TASKS_ID } from "@/config";
import { getMember } from "@/features/members/utils";
import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { createProjectSchema, updateProjectSchema } from "../schemas";
import { Project } from "../types";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { TaskStatus } from "@/features/tasks/types";

const app = new Hono()
  .post(
    "/",
    zValidator("form", createProjectSchema),
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases")
      const storage = c.get("storage")
      const user = c.get("user")

      const { name, image, workspaceId } = c.req.valid("form")

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id
      })

      if (!member) {
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




      }


      const project = await databases.createDocument(
        DATABASE_ID,
        PROJECTS_ID,
        ID.unique(),
        {
          name,
          imageUrl: uploadedImageUrl,
          workspaceId
        }
      )



      return c.json({ data: project })
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user")
      const databases = c.get("databases")

      const { workspaceId } = c.req.valid("query")

      if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400)
      }

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401)
      }

      const projects = await databases.listDocuments<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.orderDesc("$createdAt")
        ]
      );

      return c.json({ data: projects })
    }
  )
  .get(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { projectId } = c.req.param();

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
      );

      const member = await getMember({
        databases,
        workspaceId: project.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({ data: project });
    }
  )
  .patch(
    "/:projectId",
    sessionMiddleware,
    zValidator("form", updateProjectSchema),
    async (c) => {
      const databases = c.get("databases")
      const storage = c.get("storage")
      const user = c.get("user")

      const { projectId } = c.req.param()
      const { name, image } = c.req.valid("form")

      const existingProject = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      )

      const member = await getMember({
        databases,
        workspaceId: existingProject.workspaceId,
        userId: user.$id
      })

      if (!member) {
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

      const project = await databases.updateDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
        {
          name,
          imageUrl: uploadedImageUrl,
        }
      )

      return c.json({ data: project })

    }
  )
  .delete(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases")
      const user = c.get("user")

      const { projectId } = c.req.param()

      const existingProject = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      )

      const member = await getMember({
        databases,
        workspaceId: existingProject.workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401)
      }

      // todo: delete tasks related to this project

      await databases.deleteDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      )

      return c.json({ data: { $id: existingProject.$id } })
    }
  )
  .get(
    "/:projectId/analytics",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { projectId } = c.req.param();

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      const member = await getMember({
        databases,
        workspaceId: project.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const now = new Date();
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // ===== TOTAL TASKS =====
      const allTasks = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
      ]);
      const tasksAsOfLastMonth = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ]);
      const taskCount = allTasks.total;
      const taskDifference = taskCount - tasksAsOfLastMonth.total;

      // ===== ASSIGNED TASKS =====
      const allAssigned = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.equal("assigneeId", member.$id),
      ]);
      const assignedAsOfLastMonth = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.equal("assigneeId", member.$id),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ]);
      const assignedTaskCount = allAssigned.total;
      const assignedTaskDifference = assignedTaskCount - assignedAsOfLastMonth.total;

      // ===== INCOMPLETE TASKS =====
      const allIncomplete = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.notEqual("status", TaskStatus.DONE),
      ]);
      const incompleteAsOfLastMonth = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.notEqual("status", TaskStatus.DONE),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ]);
      const incompleteTaskCount = allIncomplete.total;
      const incompleteTaskDifference = incompleteTaskCount - incompleteAsOfLastMonth.total;

      // ===== COMPLETED TASKS =====
      const allCompleted = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.equal("status", TaskStatus.DONE),
      ]);
      const completedAsOfLastMonth = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.equal("status", TaskStatus.DONE),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ]);
      const completedTaskCount = allCompleted.total;
      const completedTaskDifference = completedTaskCount - completedAsOfLastMonth.total;

      // ===== OVERDUE TASKS =====
      const allOverdue = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.notEqual("status", TaskStatus.DONE),
        Query.lessThan("dueDate", now.toISOString()),
      ]);
      const overdueAsOfLastMonth = await databases.listDocuments(DATABASE_ID, TASKS_ID, [
        Query.equal("projectId", projectId),
        Query.notEqual("status", TaskStatus.DONE),
        Query.lessThan("dueDate", now.toISOString()),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ]);
      const overdueTaskCount = allOverdue.total;
      const overdueTaskDifference = overdueTaskCount - overdueAsOfLastMonth.total;

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
  );


export default app;