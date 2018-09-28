const puppeteer = require('puppeteer');
const fs = require('fs');

const INITIAL_PAGE = 'http://trak.in/india-startup-funding-investment-2015/'
const OUTPUT_TYPE = 'CSV' // or 'JSON'

const getInvesmentChartList = () => {
    let chartList = [...document.querySelectorAll('h3 > a')]
    chartList = chartList.map(a => ({ title: a.innerText, href: a.href }))
        .filter(a => !!a.title && a.title !== "" && !!a.href && a.href !== "")

    return chartList;
}

const trimValues = arr => arr.map(a => `"${a.trim()}"`)

const getRecords = async (investChart, browser) => {
    console.log(`Starting scraping for ${investChart.title}`)
    try {

        const page = await browser.newPage();
        await page.goto(investChart.href);

        const result = await page.evaluate(async () => {
            const records = [];
            let chartHeaders;

            // minor fallback to design inconsistancies
            const hasTableWrapper = !!document.querySelector('.dataTables_wrapper')
            const tableQuery = hasTableWrapper ? '.dataTables_wrapper' : 'table'

            const tables = [...document.querySelectorAll(tableQuery)]

            try {
                chartHeaders = [...tables[0].querySelector('thead').querySelectorAll('th')]
                    .map(cell => cell.innerText.trim())
            } catch (e) {
            }

            tables.forEach((table, tableNo) => {
                console.log(`started for tableNo#${tableNo}`)

                const scrapeRows = () => {

                    const rows = [...table.querySelectorAll('tbody tr')]
                    rows.map(row => {
                        const cell = [...row.querySelectorAll('td')]

                        const rowData = cell.map(cell => cell.innerText.trim())
                        records.push(rowData)
                    })

                    console.log(`Added ${rows.length} records`);
                    console.log(`hasTableWrapper`, hasTableWrapper)

                    if (hasTableWrapper) {
                        const nextBtn = table.querySelector('.paginate_button.next')
                        const hasMoreRecords = !nextBtn.classList.contains('disabled')

                        if (hasMoreRecords) {
                            nextBtn.click()
                            scrapeRows()
                        }
                    }

                }

                scrapeRows()
            })
            return hasTableWrapper ? [chartHeaders, ...records] : records
        });


        if (OUTPUT_TYPE == 'JSON') {
            const fileContent = JSON.stringify(result, null, 2)
            await fs.writeFileSync(`./${OUTPUT_TYPE}/${investChart.title}.json`, fileContent)
            console.log(`Saved ${result.length} records to ${investChart.title}\n\n`)
        }

        if (OUTPUT_TYPE == 'CSV') {
            try {
                const fileContent = result.map(record => trimValues(record).join(',')).join('\n')
                await fs.writeFileSync(`./${OUTPUT_TYPE}/${investChart.title}.csv`, fileContent)
                console.log(`Saved ${result.length} records to ${investChart.title}\n\n`)
            } catch (e) {
                console.log({ result })
                console.error(e)
            }
        }


    } catch (e) {
        console.log(
            `ERROR while scraping ${investChart.href}, ${e.message}
            skipping...\n\n`
        )
    }
}

(async () => {

    const browser = await puppeteer.launch();

    try {
        const page = await browser.newPage();
        await page.goto(INITIAL_PAGE);

        let investmentChartList = await page.evaluate(getInvesmentChartList);

        // Async iterator:
        for await (const investChart of investmentChartList) {
            await getRecords(investChart, browser)
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();