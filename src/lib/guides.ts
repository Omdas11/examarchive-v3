export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface Guide {
  slug: string;
  title: string;
  department: string;
  excerpt: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-to-use-previous-year-papers",
    title: "How to Use Previous Year Papers Without Just Memorizing Answers",
    department: "General",
    excerpt:
      "Previous year papers work best as a diagnostic tool, not as a shortcut. This guide shows a simple method: attempt first, mark honestly, then study only what the paper exposed.",
    sections: [
      {
        heading: "Attempt before you revise",
        paragraphs: [
          "Pick one paper from a year you have not studied yet, set the same time the real exam gives you, and write full answers on paper, not in your head. The point is not the score. The point is to find out, in one sitting, which topics you can actually produce under pressure and which ones only look familiar when you read them.",
          "Mark the paper the next day, not immediately. Use a different colour for three kinds of mistakes: facts you did not know, methods you knew but applied wrongly, and answers you knew but could not finish in time. Those three need three different fixes, and revising everything equally wastes the week before the exam.",
        ],
      },
      {
        heading: "Turn one paper into a study list",
        paragraphs: [
          "After marking, write down no more than ten topics to fix, in order of how often they appear across three or four years. A topic that appears every year is worth a full day. A topic that appeared once in five years is worth one worked example, not a chapter.",
          "For each topic on that list, do one thing: solve one new question on it without notes, then explain the solution aloud in two or three sentences, as if to a classmate. If you cannot explain it, you have not learned it yet, even if you recognise it on the page.",
        ],
      },
      {
        heading: "What not to do",
        paragraphs: [
          "Do not read a paper and its answers together and call that practice. Reading an answer feels like understanding, but in the exam hall there is no answer to read. Do not collect fifty papers and attempt none of them. Five papers attempted properly teach more than fifty papers skimmed.",
          "Do not trust a paper alone for the syllabus. Papers show what was asked, not what will be asked. Always check the current syllabus for your course, and treat a paper as a sample of the syllabus, not a replacement for it.",
        ],
      },
    ],
  },
  {
    slug: "physics-fyug-preparation",
    title: "How to Prepare for FYUG Physics: Mechanics, Electricity, and Modern Physics",
    department: "Physics",
    excerpt:
      "Physics exams reward method over memory. Learn the derivation once, practise the standard problem types, and keep a short list of units, limits, and approximations you actually use.",
    sections: [
      {
        heading: "Start from the derivation, not the formula sheet",
        paragraphs: [
          "In mechanics and electricity, most questions are the same few ideas with different numbers: conservation of energy and momentum, rotational motion, electric fields from symmetry, and circuits with capacitors and inductors. If you can derive the result once, slowly, you can rebuild it in the exam even if you forget the final formula.",
          "Keep a derivation notebook, one page per idea. Write the starting point, the assumption, and the step where most students go wrong. For example, in rotational problems the mistake is usually the choice of axis, and in Gauss law problems it is the choice of surface, not the integral itself.",
        ],
      },
      {
        heading: "Practise by problem type, not by chapter",
        paragraphs: [
          "After you finish a chapter, sort its previous year questions into types: find the field, find the potential, find the time period, find the current as a function of time. Practise one type at a time until the first step is automatic, then mix the types. Mixed practice is closer to a real paper, where no one tells you which chapter a question came from.",
          "In modern physics, focus on the physical meaning behind the equations: what a wave function tells you, why energy levels are discrete, and what a measurement changes. Questions that only ask you to substitute numbers are rare; questions that ask what a result means are common.",
        ],
      },
      {
        heading: "Units, limits, and checking",
        paragraphs: [
          "Before you submit an answer, check its units and its limiting case. If a formula for a pendulum gives a period that does not depend on length, something is wrong, however neat the algebra looked. A thirty-second check like this saves more marks than a last-minute extra question.",
          "In the final week, do not start a new topic. Re-solve the ten problems you got wrong earlier, from scratch, and re-derive the five formulas you keep forgetting. That is the highest-value revision for physics.",
        ],
      },
    ],
  },
  {
    slug: "chemistry-fyug-preparation",
    title: "How to Prepare for FYUG Chemistry: Organic, Inorganic, and Physical",
    department: "Chemistry",
    excerpt:
      "Chemistry splits into three different skills: mechanisms in organic, trends in inorganic, and calculations in physical. Study them differently, and do not let one weak branch drag down the other two.",
    sections: [
      {
        heading: "Organic: learn mechanisms, not reactions one by one",
        paragraphs: [
          "Organic chemistry becomes manageable when you stop memorising each reaction as a separate fact. Most reactions are a nucleophile attacking an electrophile, a leaving group leaving, or a proton moving. If you can draw the electron flow for one example, you can usually work out a new example in the same family.",
          "Make a mechanism map, not a reaction list. For each major family, write the starting material, the reagent, the intermediate, and the product, and note the one condition that changes the outcome, such as temperature, solvent, or catalyst. Exam questions often change exactly that one condition.",
        ],
      },
      {
        heading: "Inorganic: trends beat lists",
        paragraphs: [
          "Inorganic questions often test whether you understand a trend and its exception, for example why atomic size, ionisation energy, or oxidising power changes across a period and down a group, and where the trend breaks. Learn the reason for the trend, then the exception becomes a fact you can explain, not a fact you must memorise in isolation.",
          "For coordination chemistry, practise naming, geometry, and magnetic behaviour together. A question that asks for all three is really one question, and getting the geometry wrong usually makes the other two wrong as well.",
        ],
      },
      {
        heading: "Physical: practise the calculation until it is routine",
        paragraphs: [
          "Physical chemistry is where marks are most predictable, because the questions follow standard methods: thermodynamics, kinetics, electrochemistry, and solutions. Work through previous year numericals with units at every step, and keep a list of constants and their units on one page.",
          "If a numerical answer looks wrong, check the units first, then the power of ten, then the sign. Most lost marks in physical chemistry are arithmetic and unit errors, not concept errors.",
        ],
      },
    ],
  },
  {
    slug: "mathematics-fyug-preparation",
    title: "How to Prepare for FYUG Mathematics: Proof, Calculation, and Practice",
    department: "Mathematics",
    excerpt:
      "Mathematics exams test whether you can build a solution, not whether you have seen it before. Practise writing full solutions, with every step justified, and keep a list of the theorems you actually use.",
    sections: [
      {
        heading: "Write full solutions, even in practice",
        paragraphs: [
          "In practice, it is tempting to stop when you know the idea and skip the algebra. In the exam, the algebra is where the marks are, and where mistakes happen. Write every step, state which theorem or property you are using, and finish with a sentence that answers the question as asked.",
          "After solving a problem, read your solution as a marker would. Is each step justified? Is there a gap where you assumed something you did not prove? Those gaps are exactly what loses marks, even when the final answer is right.",
        ],
      },
      {
        heading: "Keep a theorem list, not a formula list",
        paragraphs: [
          "For each theorem, write its exact statement, its hypotheses, and one example where it fails if a hypothesis is dropped. Many exam questions test the hypotheses, not the conclusion. Knowing a theorem without its conditions is half a theorem.",
          "Revisit that list every week. A theorem you cannot state precisely after a week is a theorem you need to practise with, not just re-read.",
        ],
      },
      {
        heading: "Use previous papers to find your weak method",
        paragraphs: [
          "Sort previous year questions by method: induction, contradiction, epsilon-delta argument, matrix reduction, integration technique. Your weak method, not your weak chapter, is what to practise next, because the same method appears in many chapters.",
          "In the last week, re-solve the problems you got wrong the first time, without looking at your old solution. A problem you can solve twice, a week apart, is a problem you own.",
        ],
      },
    ],
  },
];
export const MORE_GUIDES: Guide[] = [
  {
    slug: "english-literature-preparation",
    title: "How to Prepare for English Literature: Reading, Argument, and Evidence",
    department: "English",
    excerpt:
      "Literature answers are arguments, not summaries. State a reading, support it with short, exact evidence from the text, and explain why that evidence supports your point.",
    sections: [
      {
        heading: "Read for argument, not for plot",
        paragraphs: [
          "When you read a poem, play, or novel for an exam, mark three things: a pattern that repeats, a moment where something changes, and a line you could quote in an answer. Plot summary alone earns few marks. A reading that connects those three things earns most of them.",
          "Before you write, decide your answer in one sentence. For example: this poem presents memory as unreliable, not as comforting. Every paragraph after that should support that sentence, or challenge it and explain why the challenge fails. An answer without a central sentence usually wanders.",
        ],
      },
      {
        heading: "Quote short, explain long",
        paragraphs: [
          "Quote two or three words, or one short line, and then spend most of your paragraph explaining what those words do. A long quotation with no explanation tells the marker you found the line, not that you understood it. The explanation is the mark.",
          "Practise by taking one past question and writing only the opening paragraph and one body paragraph, timed. If those two paragraphs make a clear argument, the rest of the answer will follow. If they do not, more writing will not fix it.",
        ],
      },
      {
        heading: "Use context, do not dump it",
        paragraphs: [
          "Historical and biographical context helps only when it changes how we read a specific passage. Mention context in the sentence where it matters, and tie it back to the text immediately. A paragraph of context with no text in it reads like a history answer, not a literature answer.",
        ],
      },
    ],
  },
  {
    slug: "history-preparation",
    title: "How to Prepare for History: Causes, Evidence, and Argument",
    department: "History",
    excerpt:
      "History answers need causes, not just events in order. Practise explaining why something happened, what evidence supports that, and what a different explanation would miss.",
    sections: [
      {
        heading: "Build timelines with causes attached",
        paragraphs: [
          "A timeline that only lists dates is a list, not an understanding. For each major event, add one cause, one consequence, and one source or piece of evidence a historian would use. That turns a date into something you can write an answer about.",
          "When you revise, cover the dates and try to reconstruct the causes from memory. If you can rebuild the chain of causes, you can answer questions even when they ask about a detail you did not memorise.",
        ],
      },
      {
        heading: "Compare explanations, do not just pick one",
        paragraphs: [
          "Good history answers show that you know historians disagree. State the strongest version of each explanation, give the evidence for it, and then say which explanation fits the evidence better and why. That structure alone lifts an answer above a simple narrative.",
          "In previous year papers, look for questions that ask why, to what extent, or how far. Those words are instructions to argue and weigh evidence, not to tell the story from start to finish.",
        ],
      },
      {
        heading: "Write with evidence in every paragraph",
        paragraphs: [
          "Each paragraph should contain at least one specific fact, date, name, or quotation from a source, and a sentence explaining what it proves. A paragraph with only general claims, however well written, reads as opinion, not history.",
        ],
      },
    ],
  },
  {
    slug: "political-science-preparation",
    title: "How to Prepare for Political Science: Concepts, Institutions, and Examples",
    department: "Political Science",
    excerpt:
      "Political science answers work when a concept is defined clearly, an institution is described accurately, and a current or historical example shows the concept in action.",
    sections: [
      {
        heading: "Define the concept first",
        paragraphs: [
          "Start an answer by defining the key concept in one or two sentences, in your own words. Democracy, federalism, sovereignty, and justice are not self-evident, and markers reward a precise definition before any discussion. If two thinkers define a concept differently, say so, and say which definition you are using.",
          "Keep a concept book: one page per concept, with a definition, a thinker associated with it, an example, and a criticism. That page is enough to answer most short and long questions on that concept.",
        ],
      },
      {
        heading: "Link institutions to outcomes",
        paragraphs: [
          "When you write about an institution, such as a parliament, a court, or a federal system, do not just describe its structure. Explain what that structure makes possible and what it makes difficult. A question about federalism is really a question about how power is shared, and what happens when that sharing is tested.",
          "Use examples from India and from one other country you know well. One well-chosen comparison teaches more than five vague examples.",
        ],
      },
      {
        heading: "Answer the question as asked",
        paragraphs: [
          "Political science questions often contain two parts: describe, and evaluate. Answer both, and keep them separate. A long description with no evaluation misses half the question, and an evaluation with no description has nothing to evaluate.",
        ],
      },
    ],
  },
  {
    slug: "economics-preparation",
    title: "How to Prepare for Economics: Diagrams, Definitions, and Data",
    department: "Economics",
    excerpt:
      "Economics marks come from clear diagrams, precise definitions, and explanations that link a change to its effect step by step, not from long paragraphs alone.",
    sections: [
      {
        heading: "Draw the diagram, then write around it",
        paragraphs: [
          "For most micro and macro questions, draw the diagram first, label every axis and curve, and show the shift or movement clearly. Then write the answer as an explanation of that diagram: what changed, what moved, and what the new equilibrium means. A correct diagram with a short explanation often earns more than a long essay with no diagram.",
          "Practise drawing the ten diagrams you use most, from memory, until the labels are automatic. In the exam, a diagram you have to think hard about costs time you need for the explanation.",
        ],
      },
      {
        heading: "Explain the chain, step by step",
        paragraphs: [
          "Economics explanations are chains: a change in price leads to a change in quantity demanded, which leads to a change in revenue, and so on. Write the chain in order, one link per sentence, and do not skip a link. Skipped links are where markers find gaps.",
          "When a question asks for evaluation, give one argument for and one against, or one short-run and one long-run effect, and say which matters more in the case given. That is evaluation, not just listing points on both sides.",
        ],
      },
      {
        heading: "Use numbers carefully",
        paragraphs: [
          "If you use data or an example, give the source or the year if you know it, and do not invent precise figures. A rough, honest figure with a clear explanation is better than a precise figure that is wrong. In numerical questions, show the formula, the substitution, and the units.",
        ],
      },
    ],
  },
  {
    slug: "bengali-preparation",
    title: "How to Prepare for Bengali: Language, Literature, and Writing",
    department: "Bengali",
    excerpt:
      "Bengali exams reward clear writing, accurate language, and close reading. Practise writing short, correct answers first, then build longer arguments on that base.",
    sections: [
      {
        heading: "Writing first, length second",
        paragraphs: [
          "In language and literature answers, clarity matters more than length. Write short sentences, use the correct form of a word, and avoid repeating the same point in different words. A marker reads many answers, and a clear answer stands out immediately.",
          "Practise by rewriting one paragraph you wrote badly, in half the words, without losing the meaning. That exercise improves every other answer you write.",
        ],
      },
      {
        heading: "Read closely, quote precisely",
        paragraphs: [
          "For literature questions, quote short passages accurately and explain what they show about character, theme, or language. Do not summarise the whole story when the question asks about one passage or one character. Focus on the part the question names.",
          "Keep a notebook of quotations you can actually reproduce, with the work and the context in one line each. Ten quotations you know well are worth more than fifty you half-remember.",
        ],
      },
      {
        heading: "Use previous papers to learn the pattern",
        paragraphs: [
          "Look at five years of papers and note which types of questions repeat: explanation of a passage, character study, essay, and language questions. Practise each type separately, timed, before you mix them. That way, no type surprises you in the hall.",
        ],
      },
    ],
  },
];
