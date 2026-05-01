import { Express } from "express";
import { createServer } from "http";
import { eq, and, sql } from "drizzle-orm";
import { differenceInMinutes, format } from "date-fns";
import PDFDocument from "pdfkit";
import { db } from "../db";
import { timeEntries, customers, invoices, projects } from "../db/schema";
import { auth, registerAuthRoutes } from "./auth";
import { registerBulkOperations } from "./bulk-operations";
import { registerNotifications } from "./notifications";
import { registerAdvancedFeatures } from "./advanced-features";
import { registerProductivityInsights } from "./productivity-insights";
import { registerTemplates } from "./templates";
import { registerProjects } from "./projects";
import { registerWorkspaceRoutes, resolveWorkspace, WorkspaceRequest } from "./workspaces";
import { initializeWebSocket } from "./websocket";
import {
  validate,
  createCustomerSchema,
  updateCustomerSchema,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  invoiceSchema,
  idParamSchema,
} from "./validation";
import { heavyLimiter, apiLimiter } from "./rate-limit";

const handleError = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred";

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.use("/api", apiLimiter);

  initializeWebSocket(httpServer);

  registerAuthRoutes(app);
  registerWorkspaceRoutes(app);
  registerBulkOperations(app);
  registerNotifications(app);
  registerAdvancedFeatures(app);
  registerProductivityInsights(app);
  registerTemplates(app);
  registerProjects(app);

  app.get("/api/customers", auth, resolveWorkspace, async (req, res) => {
    try {
      const wr = req as WorkspaceRequest;
      const allCustomers = await db
        .select()
        .from(customers)
        .where(eq(customers.workspaceId, wr.workspace.id));
      res.json(allCustomers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post(
    "/api/customers",
    auth,
    resolveWorkspace,
    validate(createCustomerSchema),
    async (req, res) => {
      try {
        const wr = req as WorkspaceRequest;
        const { name, weeklyGoalHours, billingAddress, billingEmail } = req.body;
        const [customer] = await db
          .insert(customers)
          .values({
            name,
            userId: wr.user[0].id,
            workspaceId: wr.workspace.id,
            weeklyGoalHours: weeklyGoalHours ?? null,
            billingAddress: billingAddress || null,
            billingEmail: billingEmail || null,
            createdAt: new Date(),
          })
          .returning();
        res.json(customer);
      } catch (error) {
        console.error("Error creating customer:", error);
        res.status(500).json({ error: "Failed to create customer" });
      }
    }
  );

  app.patch(
    "/api/customers/:id",
    auth,
    resolveWorkspace,
    validate(idParamSchema, "params"),
    validate(updateCustomerSchema),
    async (req, res) => {
      try {
        const wr = req as WorkspaceRequest;
        const { id } = req.params as unknown as { id: number };
        const existing = await db
          .select()
          .from(customers)
          .where(and(eq(customers.id, id), eq(customers.workspaceId, wr.workspace.id)));
        if (existing.length === 0) {
          return res.status(404).json({ error: "Customer not found" });
        }
        const [updated] = await db
          .update(customers)
          .set(req.body)
          .where(eq(customers.id, id))
          .returning();
        res.json(updated);
      } catch (error) {
        console.error("Error updating customer:", error);
        res.status(500).json({ error: "Failed to update customer" });
      }
    }
  );

  app.delete(
    "/api/customers/:id",
    auth,
    resolveWorkspace,
    validate(idParamSchema, "params"),
    async (req, res) => {
      try {
        const wr = req as WorkspaceRequest;
        const { id } = req.params as unknown as { id: number };
        await db
          .update(timeEntries)
          .set({ customerId: null, updatedAt: new Date() })
          .where(and(eq(timeEntries.customerId, id), eq(timeEntries.workspaceId, wr.workspace.id)));
        const deleted = await db
          .delete(customers)
          .where(and(eq(customers.id, id), eq(customers.workspaceId, wr.workspace.id)))
          .returning();
        if (deleted.length === 0) {
          return res.status(404).json({ error: "Customer not found" });
        }
        res.json({ message: "Customer deleted" });
      } catch (error) {
        console.error("Error deleting customer:", error);
        res.status(500).json({ error: "Failed to delete customer" });
      }
    }
  );

  app.get("/api/time-entries", auth, resolveWorkspace, async (req, res) => {
    try {
      const wr = req as WorkspaceRequest;
      const entries = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.workspaceId, wr.workspace.id),
            eq(timeEntries.userId, wr.user[0].id)
          )
        )
        .orderBy(timeEntries.checkIn);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({
        error: "Failed to fetch time entries",
        details: handleError(error),
      });
    }
  });

  app.post(
    "/api/time-entries",
    auth,
    resolveWorkspace,
    validate(createTimeEntrySchema),
    async (req, res) => {
      try {
        const wr = req as WorkspaceRequest;
        const { isBreak, customerId, projectId, notes } = req.body;

        // If projectId given, verify it's in this workspace and derive customer if absent.
        let finalCustomerId: number | null = customerId ?? null;
        let finalProjectId: number | null = projectId ?? null;
        if (finalProjectId) {
          const [p] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, finalProjectId), eq(projects.workspaceId, wr.workspace.id)));
          if (!p) {
            return res.status(400).json({ error: "Project is not in this workspace" });
          }
          if (finalCustomerId == null && p.customerId != null) {
            finalCustomerId = p.customerId;
          }
        }

        const [entry] = await db
          .insert(timeEntries)
          .values({
            userId: wr.user[0].id,
            workspaceId: wr.workspace.id,
            customerId: finalCustomerId,
            projectId: finalProjectId,
            checkIn: new Date(),
            isBreak,
            notes: notes || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        res.json(entry);
      } catch (error) {
        console.error("Failed to create time entry:", error);
        res.status(500).json({
          error: "Failed to create time entry",
          details: handleError(error),
        });
      }
    }
  );

  app.patch(
    "/api/time-entries/:id",
    auth,
    resolveWorkspace,
    validate(idParamSchema, "params"),
    validate(updateTimeEntrySchema),
    async (req, res) => {
      try {
        const wr = req as WorkspaceRequest;
        const { id } = req.params as unknown as { id: number };
        const existing = await db
          .select()
          .from(timeEntries)
          .where(
            and(
              eq(timeEntries.id, id),
              eq(timeEntries.workspaceId, wr.workspace.id),
              eq(timeEntries.userId, wr.user[0].id)
            )
          );
        if (existing.length === 0) {
          return res.status(404).json({ error: "Time entry not found" });
        }
        const { checkOut, customerId, projectId, notes, isBreak } = req.body as {
          checkOut?: string;
          customerId?: number | null;
          projectId?: number | null;
          notes?: string | null;
          isBreak?: boolean;
        };
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (checkOut) updates.checkOut = new Date(checkOut);
        if (customerId !== undefined) updates.customerId = customerId;
        if (projectId !== undefined) updates.projectId = projectId;
        if (notes !== undefined) updates.notes = notes;
        if (isBreak !== undefined) updates.isBreak = isBreak;
        const [entry] = await db
          .update(timeEntries)
          .set(updates)
          .where(eq(timeEntries.id, id))
          .returning();
        res.json(entry);
      } catch (error) {
        console.error("Failed to update time entry:", error);
        res.status(500).json({ error: "Failed to update time entry" });
      }
    }
  );

  app.delete(
    "/api/time-entries/:id",
    auth,
    resolveWorkspace,
    validate(idParamSchema, "params"),
    async (req, res) => {
      try {
        const wr = req as WorkspaceRequest;
        const { id } = req.params as unknown as { id: number };
        const deleted = await db
          .delete(timeEntries)
          .where(
            and(
              eq(timeEntries.id, id),
              eq(timeEntries.workspaceId, wr.workspace.id),
              eq(timeEntries.userId, wr.user[0].id)
            )
          )
          .returning();
        if (deleted.length === 0) {
          return res.status(404).json({ error: "Time entry not found" });
        }
        res.json({ message: "Time entry deleted" });
      } catch (error) {
        console.error("Failed to delete time entry:", error);
        res.status(500).json({ error: "Failed to delete time entry" });
      }
    }
  );

  app.post(
    "/api/generate-invoice",
    heavyLimiter,
    auth,
    resolveWorkspace,
    validate(invoiceSchema),
    async (req, res) => {
      try {
        const wr = req as WorkspaceRequest;
        const { month, year, customerId } = req.body;

        const [customer] = await db
          .select()
          .from(customers)
          .where(and(eq(customers.id, customerId), eq(customers.workspaceId, wr.workspace.id)));
        if (!customer) {
          return res.status(404).json({ error: "Customer not found" });
        }

        const entries = await db
          .select()
          .from(timeEntries)
          .where(
            and(
              eq(timeEntries.workspaceId, wr.workspace.id),
              eq(timeEntries.userId, wr.user[0].id),
              eq(timeEntries.customerId, customerId),
              eq(sql`EXTRACT(MONTH FROM ${timeEntries.checkIn})`, month),
              eq(sql`EXTRACT(YEAR FROM ${timeEntries.checkIn})`, year)
            )
          );

        await db
          .insert(invoices)
          .values({
            customerId,
            userId: wr.user[0].id,
            workspaceId: wr.workspace.id,
            month,
            year,
            status: "generated",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const doc = new PDFDocument({ size: "A4", margin: 56 });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => {
          const pdfData = Buffer.concat(chunks);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="invoice-${customer.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${year}-${String(month).padStart(2, "0")}.pdf"`
          );
          res.send(pdfData);
        });
        doc.on("error", (err) => {
          console.error("PDF stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to render invoice" });
          }
        });

        // ===== Ledger-style invoice layout =====
        const monthName = new Date(year, month - 1, 1).toLocaleString("en", {
          month: "long",
        });
        const totalMinutes = entries.reduce((sum, e) => {
          if (!e.checkOut || e.isBreak) return sum;
          return sum + differenceInMinutes(new Date(e.checkOut), new Date(e.checkIn));
        }, 0);
        const totalHours = totalMinutes / 60;

        // Masthead
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor("#B8451A")
          .text("VOL. I  ·  INVOICE  ·  " + new Date().getFullYear(), {
            characterSpacing: 2,
          });
        doc.moveDown(0.3);
        doc
          .font("Helvetica")
          .fontSize(28)
          .fillColor("#1A1510")
          .text("TimeTracker.", { continued: false });
        doc.moveDown(0.2);
        doc
          .lineWidth(0.6)
          .strokeColor("#1A1510")
          .moveTo(56, doc.y)
          .lineTo(560, doc.y)
          .stroke();
        doc.moveDown(0.8);

        // Meta block
        const metaTop = doc.y;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#7A6F5D")
          .text("RENDERED TO", 56, metaTop, { characterSpacing: 1.5 });
        doc.font("Helvetica").fontSize(13).fillColor("#1A1510")
          .text(customer.name, 56, metaTop + 14);
        if (customer.billingAddress) {
          doc.font("Helvetica").fontSize(10).fillColor("#7A6F5D")
            .text(customer.billingAddress, 56, metaTop + 34, { width: 240 });
        }
        if (customer.billingEmail) {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#7A6F5D")
            .text(customer.billingEmail, 56, doc.y + 2, { width: 240 });
        }

        doc.font("Helvetica-Bold").fontSize(8).fillColor("#7A6F5D")
          .text("PERIOD", 360, metaTop, { characterSpacing: 1.5 });
        doc.font("Helvetica").fontSize(13).fillColor("#1A1510")
          .text(`${monthName} ${year}`, 360, metaTop + 14);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#7A6F5D")
          .text("ISSUED", 360, metaTop + 44, { characterSpacing: 1.5 });
        doc.font("Helvetica").fontSize(11).fillColor("#1A1510")
          .text(format(new Date(), "d MMMM yyyy"), 360, metaTop + 58);

        // Move down past both columns
        doc.y = Math.max(doc.y, metaTop + 90);
        doc.moveDown(1.2);

        // Section label
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#B8451A")
          .text("I.  RECORDED SESSIONS", 56, doc.y, { characterSpacing: 1.5 });
        doc.moveDown(0.4);
        doc.lineWidth(0.4).strokeColor("#1A1510")
          .moveTo(56, doc.y).lineTo(560, doc.y).stroke();
        doc.moveDown(0.4);

        // Table header
        const headerY = doc.y;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#7A6F5D");
        doc.text("№", 56, headerY, { characterSpacing: 1.5 });
        doc.text("DATE", 82, headerY, { characterSpacing: 1.5 });
        doc.text("PERIOD", 170, headerY, { characterSpacing: 1.5 });
        doc.text("HOURS", 400, headerY, { width: 80, align: "right", characterSpacing: 1.5 });
        doc.text("MINUTES", 480, headerY, { width: 80, align: "right", characterSpacing: 1.5 });
        doc.moveDown(0.4);
        doc.lineWidth(0.3).strokeColor("#1A151033")
          .moveTo(56, doc.y).lineTo(560, doc.y).stroke();
        doc.moveDown(0.3);

        // Table rows
        let idx = 0;
        const workEntries = entries
          .filter((e) => e.checkOut && !e.isBreak)
          .sort((a, b) => +new Date(a.checkIn) - +new Date(b.checkIn));

        for (const entry of workEntries) {
          idx += 1;
          const rowY = doc.y;
          const mins = differenceInMinutes(new Date(entry.checkOut!), new Date(entry.checkIn));
          const hrs = (mins / 60).toFixed(2);
          doc.font("Courier").fontSize(10).fillColor("#1A1510");
          doc.text(String(idx).padStart(2, "0"), 56, rowY);
          doc.text(format(new Date(entry.checkIn), "yyyy-MM-dd"), 82, rowY);
          doc.text(
            `${format(new Date(entry.checkIn), "HH:mm")} – ${format(new Date(entry.checkOut!), "HH:mm")}`,
            170,
            rowY
          );
          doc.text(hrs, 400, rowY, { width: 80, align: "right" });
          doc.text(String(mins), 480, rowY, { width: 80, align: "right" });
          doc.moveDown(0.5);
          if (doc.y > 720) {
            doc.addPage();
          }
        }

        if (workEntries.length === 0) {
          doc.font("Helvetica-Oblique").fontSize(11).fillColor("#7A6F5D")
            .text("No recorded work sessions in this period.", 56, doc.y + 4);
          doc.moveDown(0.5);
        }

        // Ruled total line
        doc.moveDown(0.2);
        doc.lineWidth(0.6).strokeColor("#1A1510")
          .moveTo(56, doc.y).lineTo(560, doc.y).stroke();
        doc.moveDown(0.4);

        // Totals
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#B8451A")
          .text("II.  TOTAL RENDERED", 56, doc.y, { characterSpacing: 1.5 });
        doc.moveDown(0.4);

        const totalY = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor("#7A6F5D")
          .text("Sessions", 56, totalY);
        doc.font("Helvetica").fontSize(14).fillColor("#1A1510")
          .text(String(workEntries.length), 56, totalY + 12);

        doc.font("Helvetica").fontSize(10).fillColor("#7A6F5D")
          .text("Minutes", 200, totalY);
        doc.font("Courier").fontSize(14).fillColor("#1A1510")
          .text(String(totalMinutes), 200, totalY + 12);

        doc.font("Helvetica").fontSize(10).fillColor("#7A6F5D")
          .text("Hours", 340, totalY);
        doc.font("Courier").fontSize(22).fillColor("#B8451A")
          .text(totalHours.toFixed(2), 340, totalY + 10, { width: 220, align: "right" });

        // Colophon
        doc.y = Math.max(doc.y, totalY + 80);
        doc.moveDown(2);
        doc.lineWidth(0.3).strokeColor("#1A151033")
          .moveTo(56, doc.y).lineTo(560, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#7A6F5D")
          .text(
            "Issued by TimeTracker · a daily chronicle of hours spent.",
            56,
            doc.y,
            { align: "center", width: 504 }
          );

        doc.end();
      } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).json({ error: "Failed to generate invoice" });
      }
    }
  );

  return httpServer;
}
