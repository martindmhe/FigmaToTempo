import OpenAI from "openai";

const openai = new OpenAI({
    // apiKey: process.env.OPENAI_API_KEY,
    apiKey: "",
    dangerouslyAllowBrowser: true
});


const callOpenAI = async (prompt: string): Promise<string> => {
    // temporary log to confirm that response is being fetched
    console.log("fetching openai response")
    
    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            {
                role: "system", 
                content: `You are an experienced frontend engineer specialized in HTML, React and Tailwind CSS working for Tempo Labs. 
                You are tasked with receiving html code auto generated from Figma and editing it to be production-ready and return the updated code in plain text format. 
                You will only return the returned code and nothing else, the entire response should be able to be copied and run in a web app instantly.` 
            },
            {
                role: "user",
                content: prompt,
            },
        ],
    });
    
    // console.log(completion.choices[0].message);

    return completion.choices[0].message.content ?? '';
};

export default callOpenAI;
