"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, Plus, Send, Trash2 } from "lucide-react";
import { createCourseInDb, publishCourseInDb, saveAdminSnapshot } from "@/lib/admin-api";
import { loadCourseCatalog, normalizeCourse, saveCourseCatalog, type AdminCourse } from "@/lib/course-catalog";

type Question={text:string;options:string[];correctIndex:number;marks:number};
type ModuleDraft={title:string;testTitle:string;questions:Question[]};
type CourseDraft={title:string;description:string;mentor:string;category:string;level:string;visibility:string;durationMinutes:number;maxAttempts:number;passPercent:number;startDate:string;endDate:string};
const blankQuestion=():Question=>({text:"",options:["","","",""],correctIndex:0,marks:1});
const blankModule=(number:number):ModuleDraft=>({title:`Module ${number}`,testTitle:`Module ${number} Test`,questions:[blankQuestion()]});
const field="h-11 w-full rounded-lg border border-portal-line bg-white px-3 outline-none transition focus:border-portal-blue focus:ring-2 focus:ring-blue-100";
const steps=["Course Details","Schedule & Rules","Modules & Questions","Review"];

export function CourseCreationWizard(){
 const router=useRouter();
 const [step,setStep]=useState(0),[saving,setSaving]=useState(false),[error,setError]=useState(""),[createdId,setCreatedId]=useState<number|null>(null);
 const [activeModule,setActiveModule]=useState(0);
 const [course,setCourse]=useState<CourseDraft>({title:"",description:"",mentor:"",category:"Cyber Security",level:"Beginner",visibility:"Public",durationMinutes:60,maxAttempts:3,passPercent:60,startDate:"",endDate:""});
 const [modules,setModules]=useState<ModuleDraft[]>([blankModule(1)]);
 const totalQuestions=useMemo(()=>modules.reduce((sum,module)=>sum+module.questions.length,0),[modules]);
 function patchCourse(patch:Partial<CourseDraft>){setCourse((value)=>({...value,...patch}));setError("")}
 function patchModule(index:number,patch:Partial<ModuleDraft>){setModules((items)=>items.map((item,i)=>i===index?{...item,...patch}:item));setError("")}
 function patchQuestion(moduleIndex:number,questionIndex:number,patch:Partial<Question>){setModules((items)=>items.map((module,i)=>i!==moduleIndex?module:{...module,questions:module.questions.map((question,q)=>q===questionIndex?{...question,...patch}:question)}));setError("")}
 function validate(target=step){
  if(target===0&&(!course.title.trim()||!course.description.trim()||!course.mentor.trim()))return"Course title, description, and mentor are required.";
  if(target===1){
   if(course.durationMinutes<1)return"Duration must be at least one minute.";
   if(course.maxAttempts<1)return"Attempt limit must be at least one.";
   if(course.passPercent<1||course.passPercent>100)return"Pass percentage must be between 1 and 100.";
   if(course.startDate&&course.endDate&&course.endDate<course.startDate)return"End date cannot be before the start date.";
  }
  if(target===2){
   if(!modules.length)return"Add at least one module.";
   for(let m=0;m<modules.length;m+=1){
    const moduleItem=modules[m];if(!moduleItem.title.trim()||!moduleItem.testTitle.trim())return`Module ${m+1} needs a module title and test title.`;
    if(!moduleItem.questions.length)return`${moduleItem.title} needs at least one manual question.`;
    for(let q=0;q<moduleItem.questions.length;q+=1){const question=moduleItem.questions[q];if(!question.text.trim())return`${moduleItem.title}, question ${q+1}: enter the question.`;if(question.options.some((option)=>!option.trim()))return`${moduleItem.title}, question ${q+1}: complete all four options.`;if(new Set(question.options.map((option)=>option.trim().toLowerCase())).size!==4)return`${moduleItem.title}, question ${q+1}: options must be different.`;if(question.marks<1)return`${moduleItem.title}, question ${q+1}: marks must be at least one.`;}
   }
  }
  return"";
 }
 function next(){const issue=validate();if(issue){setError(issue);return}setError("");setStep((value)=>Math.min(3,value+1))}
 function addModule(){const next=[...modules,blankModule(modules.length+1)];setModules(next);setActiveModule(next.length-1)}
 function removeModule(index:number){if(modules.length===1){setError("A course must contain at least one module.");return}const next=modules.filter((_,i)=>i!==index);setModules(next);setActiveModule(Math.max(0,Math.min(activeModule,next.length-1)))}
 function addQuestion(index:number){patchModule(index,{questions:[...modules[index].questions,blankQuestion()]})}
 function removeQuestion(moduleIndex:number,questionIndex:number){const questions=modules[moduleIndex].questions.filter((_,i)=>i!==questionIndex);patchModule(moduleIndex,{questions})}
 async function publish(){
  for(const target of [0,1,2]){const issue=validate(target);if(issue){setStep(target);setError(issue);return}}
  setSaving(true);setError("");
  try{
   let id=createdId;
   if(!id){const created=await createCourseInDb({title:course.title.trim(),short_description:course.description.trim(),description:course.description.trim(),category:course.category,instructor:course.mentor.trim(),level:course.level,duration:`${course.durationMinutes} Minutes`,visibility:course.visibility.toLowerCase(),start_date:course.startDate||undefined,end_date:course.endDate||undefined,status:"draft",metadata:{description:course.description.trim(),short_description:course.description.trim(),instructor:course.mentor.trim(),mentor:course.mentor.trim(),duration:`${course.durationMinutes} Minutes`,durationMinutes:course.durationMinutes,maxAttempts:course.maxAttempts,passPercent:course.passPercent,visibility:course.visibility.toLowerCase(),startDate:course.startDate,endDate:course.endDate},modules:modules.map((module,index)=>({title:module.title.trim(),position:index+1,lessons:[]}))});id=created.id;setCreatedId(id)}
   const snapshots=modules.map((module,index)=>({title:module.title.trim(),videoUrl:"",videoSource:"youtube",quiz:module.testTitle.trim(),locked:index>0,resources:[],unlockRule:"video_quiz",maxAttempts:course.maxAttempts,durationMinutes:course.durationMinutes,passPercent:course.passPercent,generatedQuestions:module.questions.map((question)=>({question:question.text.trim(),options:question.options.map((option)=>option.trim()),answer:question.options[question.correctIndex].trim(),explanation:"",marks:question.marks}))}));
   await Promise.all([saveAdminSnapshot(`course-editor-modules-${id}-v2`,snapshots),saveAdminSnapshot(`course-settings-${id}-v1`,{startDate:course.startDate,endDate:course.endDate,durationMinutes:course.durationMinutes,maxAttempts:course.maxAttempts,passPercent:course.passPercent,unlockRule:"video_quiz",certificateEnabled:false})]);
   await publishCourseInDb(id);
   const catalog=await loadCourseCatalog();const published=normalizeCourse({id:String(id),title:course.title,category:course.category,instructor:course.mentor,status:"Published",students:0,completion:0,modules:modules.length,lessons:0,shortDescription:course.description,description:course.description,level:course.level,duration:`${course.durationMinutes} Minutes`,visibility:course.visibility});
   await saveCourseCatalog([published,...catalog.filter((item:AdminCourse)=>item.id!==String(id))]);router.push("/admin/courses");
  }catch(reason){setError(reason instanceof Error?reason.message:"Course could not be published.");setSaving(false)}
 }
 return <div className="mx-auto max-w-7xl">
  <div className="mb-6 grid gap-3 md:grid-cols-4">{steps.map((label,index)=><button key={label} type="button" onClick={()=>index<step&&setStep(index)} className={`flex items-center gap-3 rounded-xl border p-4 text-left ${index===step?"border-portal-blue bg-blue-50":index<step?"border-emerald-200 bg-white":"border-portal-line bg-white"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${index<step?"bg-emerald-600 text-white":index===step?"bg-portal-blue text-white":"bg-slate-100 text-slate-500"}`}>{index<step?<Check size={16}/>:index+1}</span><span><b className="block text-sm text-slate-900">{label}</b><small className="text-slate-500">Step {index+1} of 4</small></span></button>)}</div>
  <section className="overflow-hidden rounded-2xl border border-portal-line bg-white shadow-sm">
   <header className="border-b border-portal-line bg-gradient-to-r from-blue-50 to-white px-6 py-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-portal-blue">Step {step+1} of 4</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{steps[step]}</h1><p className="mt-1 text-sm text-slate-500">{step===0?"Define the course identity students will see.":step===1?"Set availability, timing, scoring, and attempt rules.":step===2?"Create modules and enter every question manually.":"Confirm the complete student-facing course before publishing."}</p></header>
   <div className="p-6 sm:p-8">
    {step===0?<DetailsStep course={course} patch={patchCourse}/>:null}
    {step===1?<RulesStep course={course} patch={patchCourse}/>:null}
    {step===2?<ModulesStep modules={modules} active={activeModule} setActive={setActiveModule} patchModule={patchModule} patchQuestion={patchQuestion} addModule={addModule} removeModule={removeModule} addQuestion={addQuestion} removeQuestion={removeQuestion}/>:null}
    {step===3?<ReviewStep course={course} modules={modules} totalQuestions={totalQuestions}/>:null}
    {error?<p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>:null}
   </div>
   <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-portal-line bg-slate-50 px-6 py-5"><button type="button" onClick={()=>step===0?router.push("/admin/courses"):setStep((value)=>value-1)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-portal-line bg-white px-5 text-sm font-bold text-slate-700"><ArrowLeft size={17}/>{step===0?"Cancel":"Back"}</button>{step<3?<button type="button" onClick={next} className="inline-flex h-11 items-center gap-2 rounded-lg bg-portal-blue px-6 text-sm font-bold text-white">Next<ArrowRight size={17}/></button>:<button type="button" onClick={()=>void publish()} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm disabled:opacity-60">{saving?"Publishing...":<><Send size={17}/>Save and Publish to Student Portal</>}</button>}</footer>
  </section>
 </div>;
}

function DetailsStep({course,patch}:{course:CourseDraft;patch:(value:Partial<CourseDraft>)=>void}){
 return <div className="grid gap-5 md:grid-cols-2"><Label title="Course Title *"><input autoFocus value={course.title} onChange={(e)=>patch({title:e.target.value})} className={field} placeholder="Example: Cybersecurity Foundations"/></Label><Label title="Mentor / Instructor *"><input value={course.mentor} onChange={(e)=>patch({mentor:e.target.value})} className={field} placeholder="Mentor name"/></Label><Label title="Category *"><select value={course.category} onChange={(e)=>patch({category:e.target.value})} className={field}><option>Cyber Security</option><option>Placement Prep</option><option>Programming</option><option>Assessment</option><option>General</option></select></Label><Label title="Level *"><select value={course.level} onChange={(e)=>patch({level:e.target.value})} className={field}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></Label><Label title="Course Description *" wide><textarea value={course.description} onChange={(e)=>patch({description:e.target.value})} className="min-h-36 w-full rounded-lg border border-portal-line p-3 outline-none focus:border-portal-blue focus:ring-2 focus:ring-blue-100" placeholder="Explain the course objective and what students will complete."/></Label></div>;
}
function RulesStep({course,patch}:{course:CourseDraft;patch:(value:Partial<CourseDraft>)=>void}){
 return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"><Label title="Test Duration (minutes) *"><input type="number" min={1} value={course.durationMinutes} onChange={(e)=>patch({durationMinutes:Math.max(1,Number(e.target.value)||1)})} className={field}/></Label><Label title="Maximum Attempts *"><input type="number" min={1} max={20} value={course.maxAttempts} onChange={(e)=>patch({maxAttempts:Math.max(1,Math.min(20,Number(e.target.value)||1))})} className={field}/></Label><Label title="Pass Percentage *"><input type="number" min={1} max={100} value={course.passPercent} onChange={(e)=>patch({passPercent:Math.max(1,Math.min(100,Number(e.target.value)||1))})} className={field}/></Label><Label title="Start Date"><input type="date" value={course.startDate} onChange={(e)=>patch({startDate:e.target.value})} className={field}/></Label><Label title="End Date"><input type="date" value={course.endDate} min={course.startDate||undefined} onChange={(e)=>patch({endDate:e.target.value})} className={field}/></Label><Label title="Student Visibility"><select value={course.visibility} onChange={(e)=>patch({visibility:e.target.value})} className={field}><option>Public</option><option>Batch-only</option><option>Invite-only</option></select></Label><div className="md:col-span-2 lg:col-span-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700"><b>Sequential module access is enabled.</b><p className="mt-1">Module 1 opens first. Each following module opens after the student passes the previous module test.</p></div></div>;
}
function Label({title,wide=false,children}:{title:string;wide?:boolean;children:ReactNode}){return <label className={wide?"md:col-span-2":""}><span className="mb-2 block text-sm font-bold text-slate-700">{title}</span>{children}</label>}

type ModulesStepProps={modules:ModuleDraft[];active:number;setActive:(value:number)=>void;patchModule:(index:number,patch:Partial<ModuleDraft>)=>void;patchQuestion:(moduleIndex:number,questionIndex:number,patch:Partial<Question>)=>void;addModule:()=>void;removeModule:(index:number)=>void;addQuestion:(index:number)=>void;removeQuestion:(moduleIndex:number,questionIndex:number)=>void};
function ModulesStep({modules,active,setActive,patchModule,patchQuestion,addModule,removeModule,addQuestion,removeQuestion}:ModulesStepProps){
 const moduleItem=modules[active];
 return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
  <aside className="rounded-xl border border-portal-line bg-slate-50 p-3">
   <div className="mb-3 flex items-center justify-between"><b className="text-sm">Course modules</b><button type="button" onClick={addModule} className="grid h-8 w-8 place-items-center rounded-md bg-portal-blue text-white" aria-label="Add module"><Plus size={16}/></button></div>
   <div className="space-y-2">{modules.map((item,index)=><div key={index} className={`flex items-center gap-1 rounded-lg border ${index===active?"border-portal-blue bg-white":"border-transparent"}`}><button type="button" onClick={()=>setActive(index)} className="min-w-0 flex-1 px-3 py-3 text-left"><span className="block truncate text-sm font-bold">{item.title||`Module ${index+1}`}</span><small className="text-slate-500">{item.questions.length} question{item.questions.length===1?"":"s"}</small></button><button type="button" onClick={()=>removeModule(index)} className="mr-2 grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove module ${index+1}`}><Trash2 size={15}/></button></div>)}</div>
   <button type="button" onClick={addModule} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-portal-blue text-sm font-bold text-portal-blue"><Plus size={16}/>Add Module</button>
  </aside>
  <div>
   <div className="grid gap-4 rounded-xl border border-portal-line bg-slate-50 p-4 md:grid-cols-2"><Label title="Module Title *"><input value={moduleItem.title} onChange={(e)=>patchModule(active,{title:e.target.value})} className={field}/></Label><Label title="Test Title *"><input value={moduleItem.testTitle} onChange={(e)=>patchModule(active,{testTitle:e.target.value})} className={field}/></Label></div>
   <div className="mt-5 flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-950">Manual Questions</h2><p className="text-sm text-slate-500">Enter every question, answer, and mark allocation.</p></div><button type="button" onClick={()=>addQuestion(active)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-portal-blue px-4 text-sm font-bold text-white"><Plus size={16}/>Add Question</button></div>
   <div className="mt-4 space-y-4">{moduleItem.questions.map((question,questionIndex)=><article key={questionIndex} className="rounded-xl border border-portal-line p-5">
    <div className="mb-4 flex items-center justify-between"><b>Question {questionIndex+1}</b><button type="button" onClick={()=>removeQuestion(active,questionIndex)} disabled={moduleItem.questions.length===1} className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-red-600 disabled:opacity-30"><Trash2 size={15}/>Remove</button></div>
    <Label title="Question *"><textarea value={question.text} onChange={(e)=>patchQuestion(active,questionIndex,{text:e.target.value})} className="min-h-24 w-full rounded-lg border border-portal-line p-3 outline-none focus:border-portal-blue focus:ring-2 focus:ring-blue-100" placeholder="Type the complete question"/></Label>
    <div className="mt-4 grid gap-3 md:grid-cols-2">{question.options.map((option,optionIndex)=><label key={optionIndex} className={`flex items-center gap-3 rounded-lg border p-3 ${question.correctIndex===optionIndex?"border-emerald-500 bg-emerald-50":"border-portal-line"}`}><input type="radio" name={`correct-${active}-${questionIndex}`} checked={question.correctIndex===optionIndex} onChange={()=>patchQuestion(active,questionIndex,{correctIndex:optionIndex})}/><input value={option} onChange={(e)=>{const options=[...question.options];options[optionIndex]=e.target.value;patchQuestion(active,questionIndex,{options})}} className="min-w-0 flex-1 bg-transparent outline-none" placeholder={`Option ${optionIndex+1}`}/></label>)}</div>
    <label className="mt-4 block max-w-48"><span className="mb-2 block text-sm font-bold text-slate-700">Marks *</span><input type="number" min={1} value={question.marks} onChange={(e)=>patchQuestion(active,questionIndex,{marks:Math.max(1,Number(e.target.value)||1)})} className={field}/></label>
   </article>)}</div>
   <button type="button" onClick={()=>addQuestion(active)} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-portal-blue font-bold text-portal-blue"><Plus size={17}/>Add Another Manual Question</button>
  </div>
 </div>;
}

function ReviewStep({course,modules,totalQuestions}:{course:CourseDraft;modules:ModuleDraft[];totalQuestions:number}){
 const totalMarks=modules.reduce((sum,module)=>sum+module.questions.reduce((marks,question)=>marks+question.marks,0),0);
 const facts=[["Mentor",course.mentor],["Category",course.category],["Level",course.level],["Visibility",course.visibility],["Duration",`${course.durationMinutes} minutes`],["Maximum attempts",String(course.maxAttempts)],["Pass mark",`${course.passPercent}%`],["Start date",course.startDate||"Available immediately"],["End date",course.endDate||"No end date"],["Modules",String(modules.length)],["Questions",String(totalQuestions)],["Total marks",String(totalMarks)]];
 return <div>
  <div className="rounded-2xl bg-gradient-to-r from-[#102b80] to-[#3155ff] p-6 text-white"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"><Eye size={22}/></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-100">Publication preview</p><h2 className="text-2xl font-bold">{course.title}</h2></div></div><p className="mt-4 max-w-4xl text-sm leading-6 text-blue-50">{course.description}</p></div>
  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{facts.map(([label,value])=><div key={label} className="rounded-xl border border-portal-line bg-white p-4"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span><b className="mt-1 block text-slate-950">{value}</b></div>)}</div>
  <div className="mt-6"><h3 className="text-lg font-bold text-slate-950">Module layout</h3><div className="mt-3 space-y-3">{modules.map((module,index)=>{const marks=module.questions.reduce((sum,question)=>sum+question.marks,0);return <article key={index} className="rounded-xl border border-portal-line p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-portal-blue">Module {index+1}</p><h4 className="mt-1 font-bold text-slate-950">{module.title}</h4><p className="text-sm text-slate-500">{module.testTitle}</p></div><div className="flex gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-portal-blue">{module.questions.length} questions</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{marks} marks</span></div></div><ol className="mt-4 space-y-2">{module.questions.map((question,questionIndex)=><li key={questionIndex} className="flex items-start justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{questionIndex+1}. {question.text}</span><b className="shrink-0">{question.marks} mark{question.marks===1?"":"s"}</b></li>)}</ol></article>})}</div></div>
  <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><b>Ready to publish.</b> The final button creates the course, saves all modules and questions, and publishes it to the student portal in one operation.</p>
 </div>;
}
