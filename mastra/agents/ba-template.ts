import { Agent } from "@mastra/core/agent";
import { AgentExecutionContext } from "@mastra/core/agent";
import { z } from "zod";

/**
 * =========================
 * 1. SCHEMAS
 * =========================
 */

// Input schema: what we pass into the agent
export const BusinessPotentialInputSchema = z.object({
	business_idea_summary: z
		.string()
		.describe(
			"Short description of the idea or product concept in plain language. 1–2 paragraphs max.",
		),
	problem_statement: z
		.string()
		.describe("Which painful inefficiency / frustration are we solving?"),
	target_market_guess: z
		.string()
		.describe(
			"Initial guess of target market (e.g. 'SMB e-commerce owners', 'HR teams in tech startups').",
		),
	product_type: z
		.string()
		.describe("SaaS, marketplace, AI agent, mobile app, service, hardware, etc."),
	business_model: z
		.string()
		.describe(
			"How money is captured. (Subscription, freemium+upsell, one-off fee, transaction %, ads, etc.)",
		),
	stage: z
		.string()
		.describe("idea | prototype | MVP | beta users | launched | scaling"),
	geography: z
		.string()
		.describe(
			"Primary geography/market (ex: 'Global starting in EU/US', 'Only France', 'LATAM first').",
		),
	competitors: z
		.array(z.string())
		.describe(
			"Known competitors or nearest alternatives. If unknown, provide perceived substitutes.",
		)
		.default([]),
	unique_advantage: z
		.string()
		.describe(
			"Why you win. Tech moat, distribution edge, brand, community, data, speed, cost, UX, etc.",
		),
	key_hypothesis: z
		.string()
		.describe(
			"Your core bet. Why you believe this can work / why now / why this will spread.",
		),
	resources_constraints: z
		.string()
		.describe(
			"Practical limits: solo founder, no paid marketing budget, limited engineering, regulatory, etc.",
		),
});

// Output schema: what the agent returns
export const BusinessPotentialOutputSchema = z.object({
	most_attractive_segments: z
		.array(
			z.object({
				segment_name: z.string(),
				market_size: z.string().describe("Qualitative or quantitative size estimate."),
				growth_potential: z
					.string()
					.describe("How fast is this segment growing / how urgent is the need?"),
				justification: z
					.string()
					.describe(
						"Why this segment is promising (budget, urgency, underserved pain, etc.).",
					),
			}),
		)
		.describe(
			"Top 3–5 segments where money, urgency, and adoption speed concentrate.",
		),

	icp_with_max_roi: z
		.object({
			profile: z.object({
				demographics: z
					.string()
					.describe(
						"Who they are in concrete terms. (Age range, role, company size, vertical...)",
					),
				psychographics: z
					.string()
					.describe(
						"What they care about, fear, aspire to. How they define 'winning'.",
					),
				pain_points: z
					.string()
					.describe(
						"The hair-on-fire problems that make them actively look for a solution.",
					),
				buying_triggers: z
					.string()
					.describe(
						"What event makes them take out the credit card / sign a PO today.",
					),
				preferred_channels: z
					.string()
					.describe(
						"Where/how they discover and evaluate solutions. (LinkedIn? Slack groups? Cold email? Communities? Conferences?)",
					),
				decision_makers: z
					.string()
					.describe(
						"Who signs off and who blocks it. Helpful for B2B sales loops.",
					)
					.optional(),
			}),
			economics_estimate: z.object({
				ltv: z
					.string()
					.describe(
						"Lifetime value ballpark: low / medium / high and why (deal size, retention).",
					),
				cac: z
					.string()
					.describe(
						"Customer acquisition cost difficulty: low / medium / high and why (channel cost, friction).",
					),
				roi_potential: z
					.enum(["high", "medium", "low"])
					.describe(
						"Overall attractiveness from a profitability + scalability standpoint.",
					),
			}),
		})
		.describe(
			"The single ICP (ideal customer profile) that delivers the highest ROI and best scale path.",
		),

	value_proposition: z
		.string()
		.describe(
			"Outcome-focused value pitch: 'For [ICP] who struggle with [pain], our product helps them achieve [desired outcome] by [unique mechanism].'",
		),

	focus_strategy: z.object({
		recommended_segments: z.array(
			z.object({
				segment: z
					.string()
					.describe("Which specific segment to target first / wedge market entry."),
				reason: z
					.string()
					.describe(
						"Why PMF probability is highest here (urgency, low resistance, paying budget, viral loop, etc.).",
					),
			}),
		),
		gtm_suggestions: z
			.array(
				z
					.string()
					.describe(
						"Concrete early go-to-market moves: channels, offers, wedge tactics, proof loops.",
					),
			)
			.describe("How to get first true paid traction fast."),
	}),
	summary_insight: z
		.string()
		.describe(
			"Blunt assessment of success potential: High / Medium / Low, and what must be de-risked next.",
		),
});

/**
 * =========================
 * 2. SYSTEM PROMPT / AGENT LOGIC
 * =========================
 */

const SYSTEM_PROMPT = `
You are the "Business Potential Research Agent".

Your job:
- Assess if a business idea can realistically find product–market fit and become profitable/scalable.
- Identify where money and urgency concentrate.
- Define the ICP with the highest ROI.
- Shape the value prop and wedge strategy.

Your mindset:
- You are a ruthless go-to-market strategist, not a cheerleader.
- You cut through vague personas ("millennials", "everyone who likes X") and replace them with specific buyers who actually pull out a card or sign a PO.
- You prioritize speed to paid validation, not theoretical TAM slides.

Your method (follow this structure in reasoning before producing final answer):

1. Market Mapping
   - Describe the overall market(s) this idea touches.
   - Mention macro trends that make this moment favorable (or not).
   - Note any obvious red flags (regulation, winner-take-all dynamics, brutal incumbents).

2. Customer Segmentation
   - List all plausible segments.
   - For each segment, think in terms of:
     - Urgency of pain
     - Willingness + ability to pay NOW
     - Scalability (are there many more just like them?)
     - Ease of reaching them (can we cold outbound / community / ads / partnerships?)

3. Segment Attractiveness Scoring
   - Pick the 3–5 best segments.
   - For each, explain why it's economically attractive (and if it's not, don't include it).

4. ICP With Maximum ROI
   - From those segments, choose ONE ICP that looks like the prime wedge.
   - Detail demographics / firmographics.
   - Detail psychographics (motivations, fears, political capital inside orgs, etc.).
   - Detail buying triggers and decision flow.
   - Estimate CAC difficulty and LTV potential.
   - Explicitly call ROI potential "high", "medium", or "low".

5. Value Proposition
   - Use this template:
     "For [ICP], who struggle with [core pain],
      our product helps them achieve [critical outcome they care about]
      by [your unique mechanism / differentiator],
      unlike [status quo / incumbent / workaround],
      which [key limitation of alternatives]."

   - Adapt wording to sound natural.

6. Focus Strategy
   - Tell the founder exactly which segment(s) to focus on first and why PMF probability is highest there.
   - Give specific GTM moves to test paid willingness fast (channels, offer structure, proof).

7. Final Verdict
   - State if the opportunity is High / Medium / Low potential.
   - State the single biggest risk to solve next (e.g. “Can they actually pay?”, “Can we acquire cheaply?”, “Will legal kill it?”).

VERY IMPORTANT:
- Be specific. Avoid generic marketing speak.
- Assume the founder wants to build a real business, not chase vanity metrics.
- Your final answer MUST strictly follow BusinessPotentialOutputSchema.
`;

/**
 * =========================
 * 3. AGENT DEFINITION
 * =========================
 */

export const businessPotentialAgent = new Agent({
	name: "business-potential-research-agent",
	description:
		"Analyzes a business idea to find the most attractive segment, define the ICP with max ROI, craft the value prop, and recommend a PMF-focused wedge strategy.",
	instructions: SYSTEM_PROMPT,

	// Mastra convention: we describe input/output schemas for validation + tooling/UX.
	inputSchema: BusinessPotentialInputSchema,
	outputSchema: BusinessPotentialOutputSchema

	// If you have memory or tools, attach here. For now: pure reasoning.
	tools: [],

	// (Optional depending on Mastra version)
	stream: false,
});

/**
 * =========================
 * 4. RUNTIME HELPER
 * =========================
 * You can import and call this from your route handler, server action, workflow, etc.
 *
 * Example:
 * const result = await runBusinessPotentialAnalysis({
 *   business_idea_summary: "...",
 *   problem_statement: "...",
 *   ...
 * })
 * console.log(result.focus_strategy.recommended_segments[0].segment)
 */

export async function runBusinessPotentialAnalysis(
	input: z.infer<typeof BusinessPotentialInputSchema>,
	context?: AgentExecutionContext,
) {
	// Validate input first (good for catching missing fields before LLM call)
	const parsed = BusinessPotentialInputSchema.parse(input);

	const result = await businessPotentialAgent.run(parsed, {
		// You can pass caller metadata, session id, etc. from Mastra if you use it
		...(context ?? {}),
	});

	// Optionally validate output matches schema
	const validated = BusinessPotentialOutputSchema.parse(result);

	return validated;
}

/**
 * =========================
 * 5. OPTIONAL DEV NOTE
 * =========================
 *
 * If you later add:
 * - web research tools
 * - lead scraping
 * - competitor review mining
 * - pricing intelligence
 *
 * You can plug them into `tools: [...]` above and reference them in SYSTEM_PROMPT
 * ("When relevant, call <tool> to gather competitor pricing, do not guess.")
 *
 * For now, this agent runs on structured founder input and strategic reasoning.
 */
