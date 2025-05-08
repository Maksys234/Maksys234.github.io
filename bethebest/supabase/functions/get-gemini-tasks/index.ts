// supabase/functions/get-gemini-tasks/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'; // Použij aktuální stabilní verzi Deno std
import { corsHeaders } from '../_shared/cors.ts';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    const learningContext = body.learningContext;
    if (!learningContext) {
      return new Response(JSON.stringify({
        error: 'Chybí learningContext v těle požadavku.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY není nastaven v environmentálních proměnných funkce.');
      return new Response(JSON.stringify({
        error: 'Chyba konfigurace AI služby na serveru.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    const prompt = `
    Jsi AI asistent pro studenta. Student si zaznamenává svůj postup učení.
    Toto jsou jeho poslední poznámky o učení (mohou být odděleny "---"):
    ---
    ${learningContext}
    ---
    Na základě těchto poznámek vygeneruj 2-4 krátké cvičné příklady, otázky k zopakování nebo malé úkoly.
    Formátuj odpověď jako HTML. Každý příklad/otázka by měl být v samostatném odstavci (<p>).
    Pokud je to vhodné, můžeš použít HTML tagy <details> a <summary> pro skrytí řešení nebo nápovědy, např.:
    <details>
      <summary>Klikni pro řešení/nápovědu</summary>
      <p>Zde je řešení nebo nápověda.</p>
    </details>
    Příklady by měly být relevantní k tématům v poznámkách a přiměřeně náročné.
    Udržuj přátelský, stručný a povzbuzující tón.
    Začni odpověď přímo vygenerovanými úkoly bez úvodních frází jako "Jistě, tady jsou úkoly:".
    `;
    const requestBody = {
      contents: [
        {
          parts: [
            {
              "text": prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    };
    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error('Chyba od Gemini API:', geminiResponse.status, errorData);
      throw new Error(`Gemini API vrátilo chybu: ${geminiResponse.status}. Detail: ${errorData}`);
    }
    const geminiData = await geminiResponse.json();
    let tasksText = "<p>Bohužel se nepodařilo vygenerovat žádné úkoly. Zkuste to prosím později.</p>";
    if (geminiData.candidates && geminiData.candidates.length > 0 && geminiData.candidates[0].content && geminiData.candidates[0].content.parts && geminiData.candidates[0].content.parts.length > 0) {
      tasksText = geminiData.candidates[0].content.parts[0].text;
    } else {
      console.warn("Odpověď od Gemini neměla očekávanou strukturu:", JSON.stringify(geminiData, null, 2));
    }
    return new Response(JSON.stringify({
      tasks: tasksText
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Chyba ve funkci get-gemini-tasks:', error.message, error.stack);
    return new Response(JSON.stringify({
      error: error.message || 'Nastala interní chyba serveru.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
